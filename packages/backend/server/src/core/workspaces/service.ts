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
   * Seed the "Getting Started" doc into a freshly-created workspace.
   *
   * Wave 2 B5 — first-time workspace creation. The frontend
   * `/welcome` page now drops new users into an empty workspace; this
   * method gives them an onboarding doc to land on instead of an
   * empty `/all` view.
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
  async seedStarterDoc(workspaceId: string, editorId: string): Promise<void> {
    try {
      const docId = nanoid();
      const title = 'Getting Started';

      // Build an empty root doc that registers the seeded doc. The
      // first arg `Buffer.from([0, 0])` is the canonical "empty
      // y-doc" stamp (see workspace.e2e.ts:66 + controller.spec.ts:238
      // — the test harness uses the exact same pattern).
      const rootDocUpdate = addDocToRootDoc(Buffer.from([0, 0]), docId, title);

      // Build the doc body from markdown.
      const docBinary = createDocWithMarkdown(
        title,
        STARTER_DOC_MARKDOWN,
        docId
      );

      // Push root doc first so the new doc shows up in `meta.pages`,
      // then push the doc body. If the frontend later writes its own
      // root doc, Y-doc CRDT semantics merge the two cleanly — the
      // starter doc stays registered.
      await this.docStorage.pushDocUpdates(
        workspaceId,
        workspaceId,
        [rootDocUpdate],
        editorId
      );
      await this.docStorage.pushDocUpdates(
        workspaceId,
        docId,
        [docBinary],
        editorId
      );

      this.logger.log(
        `Seeded Getting Started doc ${docId} in workspace ${workspaceId}`
      );
    } catch (err) {
      this.logger.warn(
        `Failed to seed Getting Started doc for workspace ${workspaceId}: ${
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
