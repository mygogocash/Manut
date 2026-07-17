import type { Prisma } from "@manut/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { sendEmail } from "@/infrastructure/email/email.service";
import {
  helpdeskTicketCreatedRequesterEmail,
  helpdeskTicketCreatedTeamEmail,
  helpdeskTicketStatusEmail,
} from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import {
  type CommentWithAuthor,
  helpdeskRepository,
  type TicketWithPeople,
} from "@/modules/helpdesk/helpdesk.repository";
import type {
  CreateCommentInput,
  CreateTicketInput,
  TicketQuery,
  UpdateHelpdeskSettingsInput,
  UpdateTicketInput,
} from "@/modules/helpdesk/helpdesk.validation";

/**
 * Shape returned to the FE. Mirrors the Prisma include shape but trims
 * Decimal types and renames `createdBy` to keep the contract stable if
 * we later swap the relation name.
 */
export type TicketDTO = {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  attachments: unknown;
  createdAt: string;
  updatedAt: string;
  createdBy: TicketWithPeople["createdBy"];
  assignee: TicketWithPeople["assignee"];
};

function toDTO(row: TicketWithPeople): TicketDTO {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    attachments: row.attachments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    assignee: row.assignee,
  };
}

export type CommentDTO = {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: CommentWithAuthor["author"];
};

function commentToDTO(row: CommentWithAuthor): CommentDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: row.author,
  };
}

function canSeeAll(permissions: string[]): boolean {
  return permissions.includes(PERMISSIONS.IT_READ_ALL);
}

function ensureCanRead(
  ticket: TicketWithPeople,
  actorId: string,
  permissions: string[],
) {
  if (canSeeAll(permissions)) return;
  if (ticket.createdById !== actorId && ticket.assigneeId !== actorId) {
    throw new ForbiddenException("You can only view your own tickets");
  }
}

function ensureCanUpdate(
  ticket: TicketWithPeople,
  actorId: string,
  permissions: string[],
) {
  // IT staff with read-all + update can edit anything. The original
  // requester can still tweak title / description / priority on a ticket
  // that hasn't been picked up yet ("open" status, no assignee).
  if (canSeeAll(permissions) && permissions.includes(PERMISSIONS.IT_UPDATE)) {
    return;
  }
  const isAuthor = ticket.createdById === actorId;
  const isUntouched = ticket.status === "open" && ticket.assigneeId === null;
  if (isAuthor && isUntouched) return;
  throw new ForbiddenException("You can no longer edit this ticket");
}

export class HelpdeskService {
  async list(actorId: string, permissions: string[], query: TicketQuery) {
    const where: Prisma.HelpdeskTicketWhereInput = {};

    // The Kanban (scope=all) is only available to read-all holders.
    // Everyone else collapses to their own tickets — including the
    // assignee view: an IT staffer without `it:read-all` only sees the
    // tickets routed to them, never the queue.
    if (query.scope === "all" && canSeeAll(permissions)) {
      // No actor filter — IT team sees the queue.
    } else {
      where.OR = [{ createdById: actorId }, { assigneeId: actorId }];
    }

    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.createdById) where.createdById = query.createdById;
    if (query.q) {
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const [rows, total] = await Promise.all([
      helpdeskRepository.list({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      helpdeskRepository.count(where),
    ]);

    return {
      data: rows.map(toDTO),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  // Sidebar inbox badge — count of unresolved tickets the caller can
  // see. `it:read-all` holders (triagers) get every open ticket in
  // the workspace; everyone else gets only their own (created or
  // assigned to them). Mirrors the scoping in `list()` so the badge
  // never previews a ticket the user can't open.
  async inboxCount(actorId: string, permissions: string[]) {
    const where: Prisma.HelpdeskTicketWhereInput = {
      status: { in: ["open", "in-progress", "review"] },
    };
    if (!canSeeAll(permissions)) {
      where.OR = [{ createdById: actorId }, { assigneeId: actorId }];
    }
    const total = await helpdeskRepository.count(where);
    return { data: { total } };
  }

  async getById(id: string, actorId: string, permissions: string[]) {
    const row = await helpdeskRepository.findById(id);
    if (!row) throw new NotFoundException("Ticket not found");
    ensureCanRead(row, actorId, permissions);
    return { data: toDTO(row) };
  }

  async create(input: CreateTicketInput, actorId: string) {
    const row = await helpdeskRepository.create({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      createdById: actorId,
      attachments:
        input.attachments && input.attachments.length > 0
          ? (input.attachments as unknown as Prisma.InputJsonValue)
          : undefined,
    });
    // Fan-out is fire-and-forget — email failures must not block the
    // ticket creation response. `sendEmail` already swallows errors,
    // so the only thing left is to log at the call site for traceability.
    void this.sendCreateEmails(row).catch((err) => {
      logger.error("Helpdesk create-email fan-out failed", {
        ticketId: row.id,
        error: err,
      });
    });
    // Outbound GitHub-issue mirror.
    // No-op when GitHub integration is disabled; errors swallowed +
    // logged so the API contract for ticket creation stays clean.
    const { syncTicketToGithub } =
      await import("@/modules/helpdesk/helpdesk-github-sync.service");
    void syncTicketToGithub(row.id).catch((err) => {
      logger.error("Helpdesk github sync failed", {
        ticketId: row.id,
        error: err,
      });
    });
    return { data: toDTO(row) };
  }

  private async sendCreateEmails(ticket: TicketWithPeople) {
    const settings = await helpdeskRepository.getSettings();
    const portalUrl = `${PORTAL_URL}/it-helpdesk?ticket=${ticket.id}`;
    if (settings.notifyOnCreate && settings.notifyEmails.length > 0) {
      const tpl = helpdeskTicketCreatedTeamEmail({
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        creatorName: ticket.createdBy.name,
        creatorEmail: ticket.createdBy.email,
        portalUrl,
      });
      await sendEmail({
        to: settings.notifyEmails,
        ...tpl,
        replyTo: ticket.createdBy.email,
      });
    }
    if (settings.notifyCreatorOnCreate && ticket.createdBy.email) {
      const tpl = helpdeskTicketCreatedRequesterEmail({
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        creatorName: ticket.createdBy.name,
        category: ticket.category,
        priority: ticket.priority,
        portalUrl,
      });
      await sendEmail({
        to: ticket.createdBy.email,
        ...tpl,
      });
    }
  }

  async update(
    id: string,
    input: UpdateTicketInput,
    actorId: string,
    permissions: string[],
  ) {
    const existing = await helpdeskRepository.findById(id);
    if (!existing) throw new NotFoundException("Ticket not found");

    // Author-edit lane stays narrow — they can refine title / description
    // / category / priority while the ticket is untouched, but cannot
    // flip status / assignee.
    const isItStaff =
      canSeeAll(permissions) && permissions.includes(PERMISSIONS.IT_UPDATE);
    if (!isItStaff) {
      if (
        input.status !== undefined ||
        input.assigneeId !== undefined ||
        input.resolutionNote !== undefined
      ) {
        throw new ForbiddenException(
          "Only the IT team can change status / assignee / resolution",
        );
      }
      if (
        input.assigneeId === undefined &&
        input.status === undefined &&
        input.resolutionNote === undefined
      ) {
        ensureCanUpdate(existing, actorId, permissions);
      }
    }

    // Assignee changes need `it:assign`; status flips into resolved /
    // closed need `it:resolve`. Split so a stage-1 IT helper can triage
    // without being able to mark tickets done.
    if (
      input.assigneeId !== undefined &&
      !permissions.includes(PERMISSIONS.IT_ASSIGN)
    ) {
      throw new ForbiddenException(
        "You do not have permission to assign tickets",
      );
    }
    const isResolvingTransition =
      input.status === "resolved" || input.status === "closed";
    if (
      isResolvingTransition &&
      !permissions.includes(PERMISSIONS.IT_RESOLVE)
    ) {
      throw new ForbiddenException(
        "You do not have permission to resolve / close tickets",
      );
    }

    const data: Prisma.HelpdeskTicketUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) {
      data.description = input.description.trim();
    }
    if (input.category !== undefined) data.category = input.category;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
    if (input.resolutionNote !== undefined) {
      data.resolutionNote = input.resolutionNote;
    }
    if (input.status !== undefined) {
      data.status = input.status;
      // Stamp `resolved_at` / `closed_at` on transition so a future
      // "time-to-resolve" dashboard can compute durations from the row
      // alone. Idempotent: re-entering the same status keeps the original
      // timestamp.
      if (input.status === "resolved" && existing.resolvedAt === null) {
        data.resolvedAt = new Date();
      }
      if (input.status === "closed" && existing.closedAt === null) {
        data.closedAt = new Date();
      }
    }
    // First-response stamp: the first time IT engages — an assignee is set,
    // or the ticket leaves `open` — feeds response-SLA attainment. Stamped
    // once; later transitions leave it untouched.
    const isAssigning =
      input.assigneeId !== undefined &&
      input.assigneeId !== null &&
      existing.assigneeId === null;
    const isLeavingOpen =
      input.status !== undefined &&
      input.status !== "open" &&
      existing.status === "open";
    if (existing.firstResponseAt === null && (isAssigning || isLeavingOpen)) {
      data.firstResponseAt = new Date();
    }
    // Reopen accounting: a bounce from resolved/closed back into an active
    // state increments reopened_count (first-fix-rate signal) and clears the
    // resolution stamps so the ticket re-enters the open pool cleanly and the
    // next resolve re-stamps resolved_at.
    const isReopen =
      input.status !== undefined &&
      (existing.status === "resolved" || existing.status === "closed") &&
      ["open", "in-progress", "review"].includes(input.status);
    if (isReopen) {
      data.reopenedCount = { increment: 1 };
      data.resolvedAt = null;
      data.closedAt = null;
    }
    if (input.attachments !== undefined) {
      data.attachments = input.attachments as unknown as Prisma.InputJsonValue;
    }

    const row = await helpdeskRepository.update(id, data);
    if (
      input.status !== undefined &&
      input.status !== existing.status &&
      row.createdBy.email
    ) {
      void this.sendStatusEmail(existing.status, row).catch((err) => {
        logger.error("Helpdesk status-email failed", {
          ticketId: row.id,
          error: err,
        });
      });
    }
    return { data: toDTO(row) };
  }

  private async sendStatusEmail(fromStatus: string, ticket: TicketWithPeople) {
    const settings = await helpdeskRepository.getSettings();
    if (!settings.notifyCreatorOnStatus) return;
    const portalUrl = `${PORTAL_URL}/it-helpdesk?ticket=${ticket.id}`;
    const tpl = helpdeskTicketStatusEmail({
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      recipientName: ticket.createdBy.name,
      fromStatus,
      toStatus: ticket.status,
      assigneeName: ticket.assignee?.name ?? null,
      resolutionNote: ticket.resolutionNote,
      portalUrl,
    });
    await sendEmail({
      to: ticket.createdBy.email,
      ...tpl,
    });
  }

  async getSettings() {
    const row = await helpdeskRepository.getSettings();
    return {
      data: {
        notifyEmails: row.notifyEmails,
        notifyOnCreate: row.notifyOnCreate,
        notifyCreatorOnCreate: row.notifyCreatorOnCreate,
        notifyCreatorOnStatus: row.notifyCreatorOnStatus,
        // GitHub config — token is never echoed back; the UI shows
        // "configured" indicator only.
        github: {
          enabled: row.githubEnabled,
          repoOwner: row.githubRepoOwner,
          repoName: row.githubRepoName,
          hasToken: Boolean(row.githubTokenEncrypted),
          hasWebhookSecret: Boolean(row.githubWebhookSecret),
          labelInProgress: row.githubLabelInProgress,
          labelReview: row.githubLabelReview,
        },
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  async updateSettings(input: UpdateHelpdeskSettingsInput, actorId: string) {
    const dedupedEmails = Array.from(new Set(input.notifyEmails));
    // Token + webhook secret are write-only: blank/undefined leaves the
    // stored value alone; a non-empty value re-encrypts and replaces.
    const { encrypt } = await import("@/modules/integrations/crypto");
    const githubPatch: {
      githubEnabled?: boolean;
      githubRepoOwner?: string | null;
      githubRepoName?: string | null;
      githubTokenEncrypted?: string;
      githubWebhookSecret?: string;
      githubLabelInProgress?: string;
      githubLabelReview?: string;
    } = {};
    if (input.github) {
      const g = input.github;
      githubPatch.githubEnabled = g.enabled;
      if (g.repoOwner !== undefined) {
        githubPatch.githubRepoOwner = g.repoOwner || null;
      }
      if (g.repoName !== undefined) {
        githubPatch.githubRepoName = g.repoName || null;
      }
      if (g.token) githubPatch.githubTokenEncrypted = encrypt(g.token);
      if (g.webhookSecret !== undefined && g.webhookSecret.length > 0) {
        githubPatch.githubWebhookSecret = g.webhookSecret;
      }
      if (g.labelInProgress) {
        githubPatch.githubLabelInProgress = g.labelInProgress;
      }
      if (g.labelReview) githubPatch.githubLabelReview = g.labelReview;

      // Public-repo guard. IT tickets routinely include corporate
      // emails, internal URLs, and the occasional pasted password.
      // Refuse to enable the sync against a public repo so a config
      // mistake can't permanently leak ticket bodies to Google's
      // index. We probe the repo with the freshly-supplied token so
      // the check runs against current credentials, not a stale env.
      if (g.enabled === true) {
        const owner = githubPatch.githubRepoOwner ?? undefined;
        const name = githubPatch.githubRepoName ?? undefined;
        const tokenToUse = g.token ?? null;
        if (!owner || !name || !tokenToUse) {
          throw new BadRequestException(
            "Set repoOwner, repoName, and a fresh token in the same update when enabling the GitHub sync.",
          );
        }
        const probeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
        let probe: Response;
        try {
          probe = await fetch(probeUrl, {
            headers: {
              Authorization: `Bearer ${tokenToUse}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          });
        } catch (err) {
          logger.warn("github repo probe failed", { err });
          throw new BadRequestException(
            "Could not reach GitHub to verify the repo. Check token and network.",
          );
        }
        if (!probe.ok) {
          throw new BadRequestException(
            `GitHub returned ${probe.status} for ${owner}/${name}. Check repo + token scope (needs \`repo\`).`,
          );
        }
        const body = (await probe.json()) as { private?: boolean };
        if (body.private !== true) {
          throw new BadRequestException(
            `Refusing to enable sync against a public repo (${owner}/${name}). Ticket bodies often include corporate emails and free-form descriptions; route to a private repo.`,
          );
        }
      }
    }
    const row = await helpdeskRepository.upsertSettings(
      {
        notifyEmails: dedupedEmails,
        notifyOnCreate: input.notifyOnCreate,
        notifyCreatorOnCreate: input.notifyCreatorOnCreate,
        notifyCreatorOnStatus: input.notifyCreatorOnStatus,
        ...githubPatch,
      },
      actorId,
    );
    return {
      data: {
        notifyEmails: row.notifyEmails,
        notifyOnCreate: row.notifyOnCreate,
        notifyCreatorOnCreate: row.notifyCreatorOnCreate,
        notifyCreatorOnStatus: row.notifyCreatorOnStatus,
        github: {
          enabled: row.githubEnabled,
          repoOwner: row.githubRepoOwner,
          repoName: row.githubRepoName,
          hasToken: Boolean(row.githubTokenEncrypted),
          hasWebhookSecret: Boolean(row.githubWebhookSecret),
          labelInProgress: row.githubLabelInProgress,
          labelReview: row.githubLabelReview,
        },
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  async listComments(ticketId: string, actorId: string, permissions: string[]) {
    const ticket = await helpdeskRepository.findById(ticketId);
    if (!ticket) throw new NotFoundException("Ticket not found");
    ensureCanRead(ticket, actorId, permissions);
    const rows = await helpdeskRepository.listComments(ticketId);
    return { data: rows.map(commentToDTO) };
  }

  async addComment(
    ticketId: string,
    input: CreateCommentInput,
    actorId: string,
    permissions: string[],
  ) {
    const ticket = await helpdeskRepository.findById(ticketId);
    if (!ticket) throw new NotFoundException("Ticket not found");
    // Same read gate gates the write — requester, current assignee, or any
    // IT staffer with `it:read-all` can drop a comment. Closed tickets stay
    // commentable so the audit thread isn't truncated when a ticket flips
    // status mid-conversation.
    ensureCanRead(ticket, actorId, permissions);
    const row = await helpdeskRepository.createComment({
      ticketId,
      authorId: actorId,
      body: input.body.trim(),
    });
    return { data: commentToDTO(row) };
  }

  async remove(id: string, actorId: string, permissions: string[]) {
    const existing = await helpdeskRepository.findById(id);
    if (!existing) throw new NotFoundException("Ticket not found");
    const isItStaff =
      canSeeAll(permissions) && permissions.includes(PERMISSIONS.IT_DELETE);
    const isAuthor = existing.createdById === actorId;
    if (!isItStaff && !isAuthor) {
      throw new ForbiddenException("You cannot delete this ticket");
    }
    await helpdeskRepository.delete(id);
    return { data: { id } };
  }

  /**
   * Active users eligible to be picked as a ticket assignee — the
   * IT-team roster. Matches on the trio of IT-team perms
   * (`it:assign` / `it:resolve` / `it:update`) rather than department
   * text or role name; admins inherit all three via the runtime
   * `ALL_PERMISSION_CODES` bypass so they always appear.
   */
  async listAssignees() {
    const data = await helpdeskRepository.findAssignableUsers();
    return { data };
  }
}

export const helpdeskService = new HelpdeskService();
