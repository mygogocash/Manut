import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateCommentInput,
  CreateTicketInput,
  TicketQuery,
  UpdateHelpdeskSettingsInput,
  UpdateTicketInput,
} from "@nexora/contracts/modules/helpdesk/helpdesk.validation";
import type { Db } from "@nexora/db";
import { eq, inArray, or, type SQL } from "drizzle-orm";
import { schema } from "@nexora/db";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./helpdesk.repository";

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
  createdBy: NonNullable<Awaited<ReturnType<typeof repo.findById>>>["createdBy"];
  assignee: NonNullable<Awaited<ReturnType<typeof repo.findById>>>["assignee"];
};

function toDTO(row: NonNullable<Awaited<ReturnType<typeof repo.findById>>>): TicketDTO {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
    attachments: row.attachments,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
  author: Awaited<ReturnType<typeof repo.listComments>>[number]["author"];
};

function commentToDTO(row: Awaited<ReturnType<typeof repo.listComments>>[number]): CommentDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: row.author,
  };
}

function canSeeAll(permissions: string[]): boolean {
  return permissions.includes(PERMISSIONS.IT_READ_ALL);
}

function ensureCanRead(
  ticket: NonNullable<Awaited<ReturnType<typeof repo.findById>>>,
  actorId: string,
  permissions: string[],
) {
  if (canSeeAll(permissions)) return;
  if (ticket.createdById !== actorId && ticket.assigneeId !== actorId) {
    throw new ForbiddenException("You can only view your own tickets");
  }
}

function ensureCanUpdate(
  ticket: NonNullable<Awaited<ReturnType<typeof repo.findById>>>,
  actorId: string,
  permissions: string[],
) {
  if (canSeeAll(permissions) && permissions.includes(PERMISSIONS.IT_UPDATE)) return;
  const isAuthor = ticket.createdById === actorId;
  const isUntouched = ticket.status === "open" && ticket.assigneeId === null;
  if (isAuthor && isUntouched) return;
  throw new ForbiddenException("You can no longer edit this ticket");
}

async function sendEmail(_opts: { to: string | string[]; subject: string; html: string; replyTo?: string }) {
  // Edge stub — email fan-out is handled on the Express API until Resend is wired on Workers.
}

function buildListWhere(query: TicketQuery, actorId: string, permissions: string[]): SQL[] {
  const parts: SQL[] = [];
  if (query.scope === "all" && canSeeAll(permissions)) {
    // IT queue — no actor filter
  } else {
    parts.push(
      or(
        eq(schema.helpdeskTickets.createdBy, actorId),
        eq(schema.helpdeskTickets.assigneeId, actorId),
      )!,
    );
  }
  if (query.status) parts.push(eq(schema.helpdeskTickets.status, query.status));
  if (query.category) parts.push(eq(schema.helpdeskTickets.category, query.category));
  if (query.priority) parts.push(eq(schema.helpdeskTickets.priority, query.priority));
  if (query.assigneeId) parts.push(eq(schema.helpdeskTickets.assigneeId, query.assigneeId));
  if (query.createdById) parts.push(eq(schema.helpdeskTickets.createdBy, query.createdById));
  if (query.q) parts.push(repo.searchClause(query.q));
  return parts;
}

export async function list(db: Db, actorId: string, permissions: string[], query: TicketQuery) {
  const whereParts = buildListWhere(query, actorId, permissions);
  const [rows, total] = await Promise.all([
    repo.list(db, {
      whereParts,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    repo.countTickets(db, whereParts),
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

export async function inboxCount(db: Db, actorId: string, permissions: string[]) {
  const parts: SQL[] = [
    inArray(schema.helpdeskTickets.status, ["open", "in-progress", "review"]),
  ];
  if (!canSeeAll(permissions)) {
    parts.push(
      or(
        eq(schema.helpdeskTickets.createdBy, actorId),
        eq(schema.helpdeskTickets.assigneeId, actorId),
      )!,
    );
  }
  const total = await repo.countTickets(db, parts);
  return { data: { total } };
}

export async function getById(db: Db, id: string, actorId: string, permissions: string[]) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Ticket not found");
  ensureCanRead(row, actorId, permissions);
  return { data: toDTO(row) };
}

export async function create(db: Db, input: CreateTicketInput, actorId: string) {
  const row = await repo.create(db, {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    createdById: actorId,
    attachments: input.attachments?.length ? input.attachments : undefined,
  });
  // Email + GitHub sync stubbed on edge (no-op)
  void sendEmail({ to: [], subject: "", html: "" });
  return { data: toDTO(row) };
}

export async function update(
  db: Db,
  id: string,
  input: UpdateTicketInput,
  actorId: string,
  permissions: string[],
) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Ticket not found");

  const isItStaff = canSeeAll(permissions) && permissions.includes(PERMISSIONS.IT_UPDATE);
  if (!isItStaff) {
    if (
      input.status !== undefined ||
      input.assigneeId !== undefined ||
      input.resolutionNote !== undefined
    ) {
      throw new ForbiddenException("Only the IT team can change status / assignee / resolution");
    }
    ensureCanUpdate(existing, actorId, permissions);
  }

  if (input.assigneeId !== undefined && !permissions.includes(PERMISSIONS.IT_ASSIGN)) {
    throw new ForbiddenException("You do not have permission to assign tickets");
  }
  const isResolvingTransition = input.status === "resolved" || input.status === "closed";
  if (isResolvingTransition && !permissions.includes(PERMISSIONS.IT_RESOLVE)) {
    throw new ForbiddenException("You do not have permission to resolve / close tickets");
  }

  const patch: Parameters<typeof repo.update>[2] = {
    updatedAt: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.category !== undefined) patch.category = input.category;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
  if (input.resolutionNote !== undefined) patch.resolutionNote = input.resolutionNote;
  if (input.attachments !== undefined) patch.attachments = input.attachments;

  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "resolved" && existing.resolvedAt === null) {
      patch.resolvedAt = new Date().toISOString();
    }
    if (input.status === "closed" && existing.closedAt === null) {
      patch.closedAt = new Date().toISOString();
    }
  }

  const isAssigning =
    input.assigneeId !== undefined && input.assigneeId !== null && existing.assigneeId === null;
  const isLeavingOpen =
    input.status !== undefined && input.status !== "open" && existing.status === "open";
  if (existing.firstResponseAt === null && (isAssigning || isLeavingOpen)) {
    patch.firstResponseAt = new Date().toISOString();
  }

  const isReopen =
    input.status !== undefined &&
    (existing.status === "resolved" || existing.status === "closed") &&
    ["open", "in-progress", "review"].includes(input.status);
  if (isReopen) {
    patch.reopenedCount = (existing.reopenedCount ?? 0) + 1;
    patch.resolvedAt = null;
    patch.closedAt = null;
  }

  const row = await repo.update(db, id, patch);
  if (input.status !== undefined && input.status !== existing.status) {
    void sendEmail({ to: row.createdBy.email ?? "", subject: "", html: "" });
  }
  return { data: toDTO(row) };
}

export async function getSettings(db: Db) {
  const row = await repo.getSettings(db);
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
      updatedAt: row.updatedAt,
    },
  };
}

export async function updateSettings(db: Db, input: UpdateHelpdeskSettingsInput, actorId: string) {
  const dedupedEmails = Array.from(new Set(input.notifyEmails));
  const githubPatch: Parameters<typeof repo.upsertSettings>[1] = {
    notifyEmails: dedupedEmails,
    notifyOnCreate: input.notifyOnCreate,
    notifyCreatorOnCreate: input.notifyCreatorOnCreate,
    notifyCreatorOnStatus: input.notifyCreatorOnStatus,
    updatedBy: actorId,
  };

  if (input.github) {
    const g = input.github;
    githubPatch.githubEnabled = g.enabled;
    if (g.repoOwner !== undefined) githubPatch.githubRepoOwner = g.repoOwner || null;
    if (g.repoName !== undefined) githubPatch.githubRepoName = g.repoName || null;
    if (g.token) githubPatch.githubTokenEncrypted = g.token;
    if (g.webhookSecret !== undefined && g.webhookSecret.length > 0) {
      githubPatch.githubWebhookSecret = g.webhookSecret;
    }
    if (g.labelInProgress) githubPatch.githubLabelInProgress = g.labelInProgress;
    if (g.labelReview) githubPatch.githubLabelReview = g.labelReview;

    if (g.enabled === true) {
      const owner = githubPatch.githubRepoOwner ?? undefined;
      const name = githubPatch.githubRepoName ?? undefined;
      const tokenToUse = g.token ?? null;
      if (!owner || !name || !tokenToUse) {
        throw new BadRequestException(
          "Set repoOwner, repoName, and a fresh token in the same update when enabling the GitHub sync.",
        );
      }
      let probe: Response;
      try {
        probe = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
          {
            headers: {
              Authorization: `Bearer ${tokenToUse}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          },
        );
      } catch {
        throw new BadRequestException(
          "Could not reach GitHub to verify the repo. Check token and network.",
        );
      }
      if (!probe.ok) {
        throw new BadRequestException(
          `GitHub returned ${probe.status} for ${owner}/${name}. Check repo + token scope (needs repo).`,
        );
      }
      const body = (await probe.json()) as { private?: boolean };
      if (body.private !== true) {
        throw new BadRequestException(
          `Refusing to enable sync against a public repo (${owner}/${name}). Route to a private repo.`,
        );
      }
    }
  }

  const row = await repo.upsertSettings(db, githubPatch);
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
      updatedAt: row.updatedAt,
    },
  };
}

export async function listComments(db: Db, ticketId: string, actorId: string, permissions: string[]) {
  const ticket = await repo.findById(db, ticketId);
  if (!ticket) throw new NotFoundException("Ticket not found");
  ensureCanRead(ticket, actorId, permissions);
  const rows = await repo.listComments(db, ticketId);
  return { data: rows.map(commentToDTO) };
}

export async function addComment(
  db: Db,
  ticketId: string,
  input: CreateCommentInput,
  actorId: string,
  permissions: string[],
) {
  const ticket = await repo.findById(db, ticketId);
  if (!ticket) throw new NotFoundException("Ticket not found");
  ensureCanRead(ticket, actorId, permissions);
  const row = await repo.createComment(db, {
    ticketId,
    authorId: actorId,
    body: input.body.trim(),
  });
  return { data: commentToDTO(row) };
}

export async function remove(db: Db, id: string, actorId: string, permissions: string[]) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Ticket not found");
  const isItStaff = canSeeAll(permissions) && permissions.includes(PERMISSIONS.IT_DELETE);
  const isAuthor = existing.createdById === actorId;
  if (!isItStaff && !isAuthor) {
    throw new ForbiddenException("You cannot delete this ticket");
  }
  await repo.remove(db, id);
  return { data: { id } };
}

export async function listAssignees(db: Db) {
  const data = await repo.findAssignableUsers(db);
  return { data };
}
