import { Injectable, Logger } from '@nestjs/common';
import { getStreamAsBuffer } from 'get-stream';
import { nanoid } from 'nanoid';

import { Cache, JobQueue, NotFound, URLHelper } from '../../base';
import {
  DEFAULT_WORKSPACE_AVATAR,
  DEFAULT_WORKSPACE_NAME,
  Models,
} from '../../models';
import { addDocToRootDoc, createDocWithMarkdown } from '../../native';
import { DocReader, PgWorkspaceDocStorageAdapter } from '../doc';
import { Mailer } from '../mail';
import { WorkspaceRole } from '../permission';
import { WorkspaceBlobStorage } from '../storage';

export type InviteInfo = {
  isLink: boolean;
  workspaceId: string;
  inviterUserId: string | null;
  inviteeUserId: string | null;
};

/**
 * Markdown body seeded into every brand-new workspace as the
 * "Getting Started" doc. Kept short, action-forward, and free of
 * link rot — we mention features by name rather than baking in URLs
 * that the team will rename next quarter.
 */
const STARTER_DOC_MARKDOWN = [
  "Welcome to your new workspace. Here's how to get moving in the next minute.",
  '',
  '- Open the AI sidebar with the chat icon on the right or press `Cmd+J` (`Ctrl+J` on Windows / Linux) to ask anything about this workspace.',
  '- Press `Cmd+K` (`Ctrl+K`) for the global command palette — jump to any doc, search, or trigger an action without leaving the keyboard.',
  '- Use the sidebar to create your first doc, organize with folders and tags, and pin the pages you return to most.',
  '- Tweak your account, theme, and integrations under Settings (gear icon in the sidebar) — Help lives there too if you need a hand.',
  '',
  'When you are ready, delete this doc and start writing. Everything you do here syncs automatically.',
].join('\n');

/**
 * Categorical answers persisted by the /welcome wizard.
 *
 * Wave 2 B6 — the wizard collects four answers ("context", "team",
 * "apps", "project"). We pass the categorical answers + the free-text
 * project name into `seedStarterDoc` so the very first batch of docs
 * the user lands on already mention their project name and team
 * shape. The answers are deliberately string unions (not free text)
 * for the categoricals so we can branch on them safely without an
 * LLM call at workspace-creation time.
 */
export type WizardContext =
  | 'saas'
  | 'agency'
  | 'personal'
  | 'research'
  | 'other';

export type WizardTeam = 'solo' | '2-5' | '6-20' | '20+';

export type WizardApp = 'gmail' | 'calendar' | 'github';

export interface WizardAnswers {
  context?: WizardContext;
  team?: WizardTeam;
  apps?: WizardApp[];
  /** Free text — capped/trimmed at the caller. */
  project?: string;
}

const PROJECT_TEMPLATES: Record<WizardContext, readonly string[]> = {
  saas: [
    '- Customer problem you are solving (one sentence)',
    '- Smallest shippable next milestone',
    '- Open product questions to answer before building',
    '- Risks: technical, market, distribution',
  ],
  agency: [
    '- Client + main contact',
    '- Scope of the engagement and the success metric',
    '- Next deliverable and owner',
    '- Open questions for the client',
  ],
  personal: [
    '- Why this matters to you',
    '- The next 1–2 concrete actions',
    '- Things to stop doing to make room',
    '- Anything to celebrate on the way',
  ],
  research: [
    '- The question you are trying to answer',
    '- What you already know vs. what you need to learn',
    '- Sources to read or experts to talk to',
    '- The expected output (report, decision, recommendation)',
  ],
  other: [
    '- Goal (one sentence)',
    '- Smallest next step',
    '- Open questions',
    '- People who should know about this',
  ],
};

function buildProjectPlanMarkdown(
  answers: WizardAnswers,
  projectTitle: string
): string {
  const template = PROJECT_TEMPLATES[answers.context ?? 'other'];
  return [
    `Welcome to your first project plan in this workspace. We pre-filled the structure based on how you described your work; rewrite it freely.`,
    '',
    `**Project:** ${projectTitle}`,
    '',
    '## Why we are doing this',
    '',
    template[0] ?? '- ',
    '',
    '## What good looks like',
    '',
    template[1] ?? '- ',
    template[2] ?? '- ',
    '',
    '## Risks and unknowns',
    '',
    template[3] ?? '- ',
    '',
    'Update or delete this doc — everything syncs automatically.',
  ].join('\n');
}

function buildTeamNotesMarkdown(team: WizardTeam): string {
  const sizeCopy: Record<WizardTeam, string> = {
    solo: 'just you for now',
    '2-5': 'a small, tight team',
    '6-20': 'a growing team',
    '20+': 'a large team',
  };
  return [
    `A starter "Team notes" doc for ${sizeCopy[team]}. Use this as the place to capture the things everyone should know but nobody owns yet.`,
    '',
    '## Working norms',
    '',
    '- How and where we communicate',
    '- How we make decisions',
    '- How we share progress',
    '',
    '## Operating cadence',
    '',
    '- Weekly check-ins',
    '- Where status lives',
    '- Tools we use and what they are for',
  ].join('\n');
}

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly cache: Cache,
    private readonly models: Models,
    private readonly url: URLHelper,
    private readonly doc: DocReader,
    private readonly docStorage: PgWorkspaceDocStorageAdapter,
    private readonly blobStorage: WorkspaceBlobStorage,
    private readonly mailer: Mailer,
    private readonly queue: JobQueue
  ) {}

  /**
   * Seed the "Getting Started" doc (and, when wizard answers are
   * provided, a Project Plan + Team Notes doc) into a freshly-created
   * workspace.
   *
   * Wave 2 B5 — first-time workspace creation. The frontend
   * `/welcome` page now drops new users into an empty workspace; this
   * method gives them an onboarding doc to land on instead of an
   * empty `/all` view.
   *
   * Wave 2 B6 — `/welcome` now collects four onboarding answers
   * (context / team / apps / project) before workspace creation. We
   * accept the answers as an optional argument and use them to add
   * 1–2 additional starter docs tailored to the user's stated work
   * type. Templates are STATIC text per categorical answer; we
   * intentionally do NOT call an LLM at workspace-creation time so
   * the user lands on real content even with the AI provider down.
   *
   * At the moment `createWorkspace` returns, the workspace row exists
   * in Postgres but no y-doc snapshots have been written yet — the
   * frontend pushes the initial root doc + sub-doc state via the doc
   * sync system after the GraphQL response. So we seed the root doc
   * AND the starter doc directly through `PgWorkspaceDocStorageAdapter`,
   * using the same native helpers (`addDocToRootDoc`,
   * `createDocWithMarkdown`) that `DocWriter` uses. Y-doc updates are
   * additive CRDTs, so this seed and the frontend's later root-doc
   * push merge cleanly.
   *
   * Best-effort: any failure is logged and swallowed so a seed problem
   * cannot break the workspace-creation transaction. The workspace
   * already exists at this point; the user can always create a doc
   * themselves.
   */
  async seedStarterDoc(
    workspaceId: string,
    editorId: string,
    answers?: WizardAnswers
  ): Promise<void> {
    try {
      // Build the list of docs to seed. "Getting Started" is always
      // first. We add a Project Plan when the wizard captured a
      // non-empty `project`, and Team Notes when team-size is
      // anything other than `solo`.
      const docs: Array<{ title: string; markdown: string }> = [
        { title: 'Getting Started', markdown: STARTER_DOC_MARKDOWN },
      ];

      const trimmedProject = answers?.project?.trim();
      if (trimmedProject && trimmedProject.length > 0) {
        // Cap project title at 80 chars to avoid runaway input from
        // the free-text step rendering oddly in the sidebar.
        const projectTitle = trimmedProject.slice(0, 80);
        docs.push({
          title: `Project plan for ${projectTitle}`,
          markdown: buildProjectPlanMarkdown(answers ?? {}, projectTitle),
        });
      }

      if (answers?.team && answers.team !== 'solo') {
        docs.push({
          title: 'Team notes',
          markdown: buildTeamNotesMarkdown(answers.team),
        });
      }

      // Build root-doc registration deltas for every doc, then push
      // them sequentially against the empty y-doc baseline. Y-doc
      // updates are CRDTs so the order is irrelevant for correctness,
      // but we keep the natural order so the doc-list reads top-down
      // in the sidebar.
      let rootDocBuffer: Buffer = Buffer.from([0, 0]);
      const pendingDocPushes: Array<{ docId: string; binary: Buffer }> = [];

      for (const { title, markdown } of docs) {
        const docId = nanoid();
        rootDocBuffer = addDocToRootDoc(rootDocBuffer, docId, title);
        pendingDocPushes.push({
          docId,
          binary: createDocWithMarkdown(title, markdown, docId),
        });
      }

      // Push the assembled root doc first so all docs show up in
      // `meta.pages`, then push each doc body.
      await this.docStorage.pushDocUpdates(
        workspaceId,
        workspaceId,
        [rootDocBuffer],
        editorId
      );
      for (const { docId, binary } of pendingDocPushes) {
        await this.docStorage.pushDocUpdates(
          workspaceId,
          docId,
          [binary],
          editorId
        );
      }

      this.logger.log(
        `Seeded ${docs.length} starter doc(s) in workspace ${workspaceId}`
      );
    } catch (err) {
      this.logger.warn(
        `Failed to seed starter docs for workspace ${workspaceId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  async getInviteInfo(inviteId: string): Promise<InviteInfo> {
    // invite link
    const invite = await this.cache.get<InviteInfo>(
      `workspace:inviteLinkId:${inviteId}`
    );
    if (typeof invite?.workspaceId === 'string') {
      return {
        ...invite,
        isLink: true,
      };
    }

    const workspaceUser = await this.models.workspaceUser.getById(inviteId);

    if (!workspaceUser) {
      throw new NotFound('Invitation not found');
    }

    return {
      isLink: false,
      workspaceId: workspaceUser.workspaceId,
      inviteeUserId: workspaceUser.userId,
      inviterUserId: workspaceUser.inviterId,
    };
  }

  async getWorkspaceInfo(workspaceId: string) {
    const workspaceContent = await this.doc.getWorkspaceContent(workspaceId);

    let avatar = DEFAULT_WORKSPACE_AVATAR;
    if (workspaceContent?.avatarKey) {
      const avatarBlob = await this.blobStorage.get(
        workspaceId,
        workspaceContent.avatarKey
      );

      if (avatarBlob.body) {
        avatar = (await getStreamAsBuffer(avatarBlob.body)).toString('base64');
      }
    }

    return {
      avatar,
      id: workspaceId,
      name: workspaceContent?.name ?? DEFAULT_WORKSPACE_NAME,
    };
  }

  async sendInvitationAcceptedNotification(
    inviterId: string,
    inviteId: string
  ) {
    await this.queue.add('notification.sendInvitationAccepted', {
      inviterId,
      inviteId,
    });
  }
  async sendInvitationNotification(inviterId: string, inviteId: string) {
    await this.queue.add('notification.sendInvitation', {
      inviterId,
      inviteId,
    });
  }

  // ================ Team ================
  async isTeamWorkspace(workspaceId: string) {
    return this.models.workspace.isTeamWorkspace(workspaceId);
  }

  async sendTeamWorkspaceUpgradedEmail(workspaceId: string) {
    const owner = await this.models.workspaceUser.getOwner(workspaceId);
    const admins = await this.models.workspaceUser.getAdmins(workspaceId);

    const link = this.url.link(`/workspace/${workspaceId}`);
    await this.mailer.trySend({
      name: 'TeamWorkspaceUpgraded',
      to: owner.email,
      props: {
        workspace: {
          $$workspaceId: workspaceId,
        },
        isOwner: true,
        url: link,
      },
    });

    await Promise.allSettled(
      admins.map(async user => {
        await this.mailer.trySend({
          name: 'TeamWorkspaceUpgraded',
          to: user.email,
          props: {
            workspace: {
              $$workspaceId: workspaceId,
            },
            isOwner: false,
            url: link,
          },
        });
      })
    );
  }

  async sendReviewRequestNotification(inviteId: string) {
    const { workspaceId, inviteeUserId } = await this.getInviteInfo(inviteId);
    if (!inviteeUserId) {
      this.logger.error(`Invitee user not found for inviteId: ${inviteId}`);
      return;
    }

    const owner = await this.models.workspaceUser.getOwner(workspaceId);
    const admins = await this.models.workspaceUser.getAdmins(workspaceId);

    await Promise.allSettled(
      [owner, ...admins].map(async reviewer => {
        await this.queue.add('notification.sendInvitationReviewRequest', {
          reviewerId: reviewer.id,
          inviteId,
        });
      })
    );
  }

  async sendReviewApprovedNotification(inviteId: string, reviewerId: string) {
    await this.queue.add('notification.sendInvitationReviewApproved', {
      reviewerId,
      inviteId,
    });
  }

  async sendReviewDeclinedNotification(
    userId: string,
    workspaceId: string,
    reviewerId: string
  ) {
    await this.queue.add('notification.sendInvitationReviewDeclined', {
      reviewerId,
      userId,
      workspaceId,
    });
  }

  async sendRoleChangedEmail(
    userId: string,
    ws: { id: string; role: WorkspaceRole }
  ) {
    const user = await this.models.user.getWorkspaceUser(userId);
    if (!user) {
      this.logger.warn(
        `User not found for seeding role changed email: ${userId}`
      );
      return;
    }

    if (ws.role === WorkspaceRole.Admin) {
      await this.mailer.trySend({
        name: 'TeamBecomeAdmin',
        to: user.email,
        props: {
          workspace: {
            $$workspaceId: ws.id,
          },
          url: this.url.link(`/workspace/${ws.id}`),
        },
      });
    } else {
      await this.mailer.trySend({
        name: 'TeamBecomeCollaborator',
        to: user.email,
        props: {
          workspace: {
            $$workspaceId: ws.id,
          },
          url: this.url.link(`/workspace/${ws.id}`),
        },
      });
    }
  }

  async sendOwnershipTransferredEmail(email: string, ws: { id: string }) {
    await this.mailer.trySend({
      name: 'OwnershipTransferred',
      to: email,
      props: {
        workspace: {
          $$workspaceId: ws.id,
        },
      },
    });
  }

  async sendOwnershipReceivedEmail(email: string, ws: { id: string }) {
    await this.mailer.trySend({
      name: 'OwnershipReceived',
      to: email,
      props: {
        workspace: {
          $$workspaceId: ws.id,
        },
      },
    });
  }

  async sendLeaveEmail(workspaceId: string, userId: string) {
    const owner = await this.models.workspaceUser.getOwner(workspaceId);
    await this.mailer.trySend({
      name: 'MemberLeave',
      to: owner.email,
      props: {
        workspace: {
          $$workspaceId: workspaceId,
        },
        user: {
          $$userId: userId,
        },
      },
    });
  }

  async allocateSeats(workspaceId: string, quantity: number) {
    const pendings = await this.models.workspaceUser.allocateSeats(
      workspaceId,
      quantity
    );

    if (!pendings.length) {
      return;
    }

    const owner = await this.models.workspaceUser.getOwner(workspaceId);
    for (const member of pendings) {
      try {
        await this.queue.add('notification.sendInvitation', {
          inviterId: member.inviterId ?? owner.id,
          inviteId: member.id,
        });
      } catch (e) {
        this.logger.error('Failed to send invitation notification', e);
      }
    }
  }
}
