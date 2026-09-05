import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";

const creator = alias(schema.users, "helpdesk_creator");
const assignee = alias(schema.users, "helpdesk_assignee");
const commentAuthor = alias(schema.users, "helpdesk_comment_author");

const personSelect = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
  avatarUrl: schema.users.avatarUrl,
  department: schema.users.department,
  jobTitle: schema.users.jobTitle,
};

export type TicketWithPeople = Awaited<ReturnType<typeof findById>> & {};

async function loadTicketRow(db: Db, where: SQL) {
  const [row] = await db
    .select({
      ticket: schema.helpdeskTickets,
      createdById: creator.id,
      createdByName: creator.name,
      createdByEmail: creator.email,
      createdByAvatar: creator.avatarUrl,
      createdByDept: creator.department,
      createdByJob: creator.jobTitle,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
      assigneeAvatar: assignee.avatarUrl,
      assigneeDept: assignee.department,
      assigneeJob: assignee.jobTitle,
    })
    .from(schema.helpdeskTickets)
    .innerJoin(creator, eq(schema.helpdeskTickets.createdBy, creator.id))
    .leftJoin(assignee, eq(schema.helpdeskTickets.assigneeId, assignee.id))
    .where(where)
    .limit(1);
  if (!row) return null;
  return {
    ...row.ticket,
    createdById: row.createdById,
    createdBy: {
      id: row.createdById,
      name: row.createdByName,
      email: row.createdByEmail,
      avatarUrl: row.createdByAvatar,
      department: row.createdByDept,
      jobTitle: row.createdByJob,
    },
    assignee: row.assigneeId
      ? {
          id: row.assigneeId,
          name: row.assigneeName!,
          email: row.assigneeEmail!,
          avatarUrl: row.assigneeAvatar,
          department: row.assigneeDept,
          jobTitle: row.assigneeJob,
        }
      : null,
  };
}

export async function list(
  db: Db,
  args: { whereParts: SQL[]; skip: number; take: number },
) {
  const where = args.whereParts.length ? and(...args.whereParts) : undefined;
  const rows = await db
    .select({
      ticket: schema.helpdeskTickets,
      createdById: creator.id,
      createdByName: creator.name,
      createdByEmail: creator.email,
      createdByAvatar: creator.avatarUrl,
      createdByDept: creator.department,
      createdByJob: creator.jobTitle,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
      assigneeAvatar: assignee.avatarUrl,
      assigneeDept: assignee.department,
      assigneeJob: assignee.jobTitle,
    })
    .from(schema.helpdeskTickets)
    .innerJoin(creator, eq(schema.helpdeskTickets.createdBy, creator.id))
    .leftJoin(assignee, eq(schema.helpdeskTickets.assigneeId, assignee.id))
    .where(where)
    .orderBy(asc(schema.helpdeskTickets.status), desc(schema.helpdeskTickets.createdAt))
    .limit(args.take)
    .offset(args.skip);

  return rows.map((row) => ({
    ...row.ticket,
    createdById: row.createdById,
    createdBy: {
      id: row.createdById,
      name: row.createdByName,
      email: row.createdByEmail,
      avatarUrl: row.createdByAvatar,
      department: row.createdByDept,
      jobTitle: row.createdByJob,
    },
    assignee: row.assigneeId
      ? {
          id: row.assigneeId,
          name: row.assigneeName!,
          email: row.assigneeEmail!,
          avatarUrl: row.assigneeAvatar,
          department: row.assigneeDept,
          jobTitle: row.assigneeJob,
        }
      : null,
  }));
}

export async function countTickets(db: Db, whereParts: SQL[]) {
  const where = whereParts.length ? and(...whereParts) : undefined;
  const [row] = await db.select({ n: count() }).from(schema.helpdeskTickets).where(where);
  return Number(row?.n ?? 0);
}

export async function findById(db: Db, id: string) {
  return loadTicketRow(db, eq(schema.helpdeskTickets.id, id));
}

export async function create(
  db: Db,
  data: {
    title: string;
    description: string;
    category: string;
    priority: string;
    createdById: string;
    attachments?: unknown;
  },
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.helpdeskTickets).values({
    id,
    title: data.title,
    description: data.description,
    category: data.category,
    priority: data.priority,
    createdBy: data.createdById,
    attachments: data.attachments ?? null,
    updatedAt: now,
  });
  const row = await findById(db, id);
  if (!row) throw new Error("HELPDESK_CREATE_FAILED");
  return row;
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    assigneeId: string | null;
    resolutionNote: string | null;
    resolvedAt: string | null;
    closedAt: string | null;
    firstResponseAt: string | null;
    reopenedCount: number;
    attachments: unknown;
    updatedAt: string;
  }>,
) {
  await db.update(schema.helpdeskTickets).set(data).where(eq(schema.helpdeskTickets.id, id));
  const row = await findById(db, id);
  if (!row) throw new Error("HELPDESK_UPDATE_FAILED");
  return row;
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.helpdeskTickets).where(eq(schema.helpdeskTickets.id, id));
}

export async function listComments(db: Db, ticketId: string) {
  const rows = await db
    .select({
      comment: schema.helpdeskComments,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
      authorAvatar: commentAuthor.avatarUrl,
      authorJob: commentAuthor.jobTitle,
    })
    .from(schema.helpdeskComments)
    .innerJoin(commentAuthor, eq(schema.helpdeskComments.authorId, commentAuthor.id))
    .where(eq(schema.helpdeskComments.ticketId, ticketId))
    .orderBy(asc(schema.helpdeskComments.createdAt));
  return rows.map((r) => ({
    ...r.comment,
    author: {
      id: r.authorId,
      name: r.authorName,
      email: r.authorEmail,
      avatarUrl: r.authorAvatar,
      jobTitle: r.authorJob,
    },
  }));
}

export async function createComment(db: Db, data: { ticketId: string; authorId: string; body: string }) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.helpdeskComments).values({
    id,
    ticketId: data.ticketId,
    authorId: data.authorId,
    body: data.body,
    updatedAt: now,
  });
  const [row] = await db
    .select({
      comment: schema.helpdeskComments,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
      authorAvatar: commentAuthor.avatarUrl,
      authorJob: commentAuthor.jobTitle,
    })
    .from(schema.helpdeskComments)
    .innerJoin(commentAuthor, eq(schema.helpdeskComments.authorId, commentAuthor.id))
    .where(eq(schema.helpdeskComments.id, id))
    .limit(1);
  if (!row) throw new Error("HELPDESK_COMMENT_FAILED");
  return {
    ...row.comment,
    author: {
      id: row.authorId,
      name: row.authorName,
      email: row.authorEmail,
      avatarUrl: row.authorAvatar,
      jobTitle: row.authorJob,
    },
  };
}

export async function findAssignableUsers(db: Db) {
  const IT_TEAM_CODES = ["it:assign", "it:resolve", "it:update"];
  const rows = await db
    .selectDistinct({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      jobTitle: schema.users.jobTitle,
    })
    .from(schema.users)
    .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .leftJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.roles.id))
    .where(
      and(
        eq(schema.users.isActive, true),
        or(
          and(eq(schema.roles.isSystem, true), eq(schema.roles.name, "Admin")),
          inArray(schema.rolePermissions.permissionCode, IT_TEAM_CODES),
        ),
      ),
    )
    .orderBy(asc(schema.users.name));
  return rows;
}

export async function getSettings(db: Db) {
  const [row] = await db
    .select()
    .from(schema.helpdeskSettings)
    .where(eq(schema.helpdeskSettings.singleton, true))
    .limit(1);
  if (row) return row;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.helpdeskSettings).values({
    id,
    singleton: true,
    notifyEmails: [],
    updatedAt: now,
  });
  const [created] = await db
    .select()
    .from(schema.helpdeskSettings)
    .where(eq(schema.helpdeskSettings.singleton, true))
    .limit(1);
  return created!;
}

export async function upsertSettings(
  db: Db,
  data: {
    notifyEmails: string[];
    notifyOnCreate: boolean;
    notifyCreatorOnCreate: boolean;
    notifyCreatorOnStatus: boolean;
    githubEnabled?: boolean;
    githubRepoOwner?: string | null;
    githubRepoName?: string | null;
    githubTokenEncrypted?: string;
    githubWebhookSecret?: string;
    githubLabelInProgress?: string;
    githubLabelReview?: string;
    updatedBy: string;
  },
) {
  const now = new Date().toISOString();
  const existing = await getSettings(db);
  await db
    .update(schema.helpdeskSettings)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.helpdeskSettings.id, existing.id));
  return getSettings(db);
}

export function searchClause(q: string): SQL {
  const pattern = `%${q}%`;
  return or(
    ilike(schema.helpdeskTickets.title, pattern),
    ilike(schema.helpdeskTickets.description, pattern),
  )!;
}
