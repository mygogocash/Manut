import { and, asc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbTransaction } from "@nexora/db";

type DbLike = Db | DbTransaction;
import { schema } from "@nexora/db";

const memberUser = alias(schema.users, "partner_member_user");
const taskOwner = alias(schema.users, "partner_task_owner");
const assigneeUser = alias(schema.users, "partner_task_assignee_user");
const commentAuthor = alias(schema.users, "partner_comment_author");

export const DEFAULT_COLUMNS = [
  { key: "backlog", label: "Backlog", color: "bg-zinc-500", sortOrder: 0 },
  { key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 1 },
  { key: "in_progress", label: "In Progress", color: "bg-amber-500", sortOrder: 2 },
  { key: "in_review", label: "In Review", color: "bg-purple-500", sortOrder: 3 },
  { key: "done", label: "Done", color: "bg-emerald-500", sortOrder: 4 },
] as const;

function nowIso() {
  return new Date().toISOString();
}

export async function requirePartner(db: Db, idOrSlug: string) {
  const [row] = await db
    .select({
      id: schema.partners.id,
      slug: schema.partners.slug,
      company: schema.partners.company,
      ownerId: schema.partners.ownerId,
    })
    .from(schema.partners)
    .where(or(eq(schema.partners.id, idOrSlug), eq(schema.partners.slug, idOrSlug)))
    .limit(1);
  return row ?? null;
}

export async function listColumns(db: Db, partnerId: string) {
  return db
    .select()
    .from(schema.partnerColumns)
    .where(eq(schema.partnerColumns.partnerId, partnerId))
    .orderBy(asc(schema.partnerColumns.sortOrder), asc(schema.partnerColumns.key));
}

export async function seedDefaultColumns(db: Db, partnerId: string) {
  await db
    .insert(schema.partnerColumns)
    .values(
      DEFAULT_COLUMNS.map((c) => ({
        id: crypto.randomUUID(),
        partnerId,
        key: c.key,
        label: c.label,
        color: c.color,
        sortOrder: c.sortOrder,
      })),
    )
    .onConflictDoNothing();
}

async function loadTaskAssignees(db: DbLike, taskId: string) {
  const rows = await db
    .select({
      userId: schema.partnerTaskAssignees.userId,
      allocationPct: schema.partnerTaskAssignees.allocationPct,
      name: assigneeUser.name,
      email: assigneeUser.email,
    })
    .from(schema.partnerTaskAssignees)
    .innerJoin(assigneeUser, eq(schema.partnerTaskAssignees.userId, assigneeUser.id))
    .where(eq(schema.partnerTaskAssignees.taskId, taskId));
  return rows.map((r) => ({
    userId: r.userId,
    allocationPct: r.allocationPct,
    user: { id: r.userId, name: r.name, email: r.email },
  }));
}

export async function listTasksWithRelations(db: Db, partnerId: string) {
  const tasks = await db
    .select({
      task: schema.partnerTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.partnerTasks)
    .leftJoin(taskOwner, eq(schema.partnerTasks.ownerId, taskOwner.id))
    .where(eq(schema.partnerTasks.partnerId, partnerId))
    .orderBy(asc(schema.partnerTasks.sortOrder), asc(schema.partnerTasks.createdAt));

  return Promise.all(
    tasks.map(async (row) => {
      const [assignees, resources] = await Promise.all([
        loadTaskAssignees(db, row.task.id),
        db
          .select()
          .from(schema.partnerTaskResources)
          .where(eq(schema.partnerTaskResources.taskId, row.task.id))
          .orderBy(asc(schema.partnerTaskResources.createdAt)),
      ]);
      return {
        ...row.task,
        owner: row.ownerId ? { id: row.ownerId, name: row.ownerName!, email: row.ownerEmail! } : null,
        assignees,
        resources,
      };
    }),
  );
}

export async function listMembers(db: DbLike, partnerId: string) {
  const rows = await db
    .select({
      member: schema.partnerMembers,
      userId: memberUser.id,
      userName: memberUser.name,
      userEmail: memberUser.email,
    })
    .from(schema.partnerMembers)
    .innerJoin(memberUser, eq(schema.partnerMembers.userId, memberUser.id))
    .where(eq(schema.partnerMembers.partnerId, partnerId))
    .orderBy(asc(schema.partnerMembers.createdAt));
  return rows.map((r) => ({
    ...r.member,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}

export async function findTask(db: Db, taskId: string, partnerId: string) {
  const [row] = await db
    .select({ id: schema.partnerTasks.id, partnerId: schema.partnerTasks.partnerId })
    .from(schema.partnerTasks)
    .where(and(eq(schema.partnerTasks.id, taskId), eq(schema.partnerTasks.partnerId, partnerId)))
    .limit(1);
  return row ?? null;
}

export async function findParentTask(db: Db, parentTaskId: string) {
  const [row] = await db
    .select({ id: schema.partnerTasks.id, partnerId: schema.partnerTasks.partnerId })
    .from(schema.partnerTasks)
    .where(eq(schema.partnerTasks.id, parentTaskId))
    .limit(1);
  return row ?? null;
}

export async function findColumn(db: Db, columnId: string, partnerId: string) {
  const [row] = await db
    .select({ id: schema.partnerColumns.id, partnerId: schema.partnerColumns.partnerId })
    .from(schema.partnerColumns)
    .where(and(eq(schema.partnerColumns.id, columnId), eq(schema.partnerColumns.partnerId, partnerId)))
    .limit(1);
  return row ?? null;
}

export async function loadTaskDetail(db: DbLike, taskId: string) {
  const [row] = await db
    .select({
      task: schema.partnerTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.partnerTasks)
    .leftJoin(taskOwner, eq(schema.partnerTasks.ownerId, taskOwner.id))
    .where(eq(schema.partnerTasks.id, taskId))
    .limit(1);
  if (!row) return null;
  const [assignees, resources] = await Promise.all([
    loadTaskAssignees(db, taskId),
    db
      .select()
      .from(schema.partnerTaskResources)
      .where(eq(schema.partnerTaskResources.taskId, taskId))
      .orderBy(asc(schema.partnerTaskResources.createdAt)),
  ]);
  return {
    ...row.task,
    owner: row.ownerId ? { id: row.ownerId, name: row.ownerName!, email: row.ownerEmail! } : null,
    assignees,
    resources,
  };
}

export async function createTask(
  db: Db,
  partnerId: string,
  data: {
    parentTaskId?: string | null;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    ownerId: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sortOrder: number;
    assigneeIds?: string[];
  },
) {
  const id = crypto.randomUUID();
  const now = nowIso();
  return db.transaction(async (tx) => {
    await tx.insert(schema.partnerTasks).values({
      id,
      partnerId,
      parentTaskId: data.parentTaskId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      ownerId: data.ownerId,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      sortOrder: data.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
    if (data.assigneeIds?.length) {
      await tx.insert(schema.partnerTaskAssignees).values(
        data.assigneeIds.map((userId) => ({
          id: crypto.randomUUID(),
          taskId: id,
          userId,
          createdAt: now,
        })),
      );
    }
    return loadTaskDetail(tx, id);
  });
}

export async function updateTask(
  db: Db,
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    ownerId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sortOrder?: number;
    assigneeIds?: string[];
  },
) {
  const now = nowIso();
  return db.transaction(async (tx) => {
    const patch: Partial<typeof schema.partnerTasks.$inferInsert> = { updatedAt: now };
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.ownerId !== undefined) patch.ownerId = data.ownerId;
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;

    await tx.update(schema.partnerTasks).set(patch).where(eq(schema.partnerTasks.id, taskId));

    if (data.assigneeIds !== undefined) {
      await tx.delete(schema.partnerTaskAssignees).where(eq(schema.partnerTaskAssignees.taskId, taskId));
      if (data.assigneeIds.length) {
        await tx.insert(schema.partnerTaskAssignees).values(
          data.assigneeIds.map((userId) => ({
            id: crypto.randomUUID(),
            taskId,
            userId,
            createdAt: now,
          })),
        );
      }
    }

    return loadTaskDetail(tx, taskId);
  });
}

export async function deleteTask(db: Db, taskId: string) {
  await db.delete(schema.partnerTasks).where(eq(schema.partnerTasks.id, taskId));
}

export async function createColumn(
  db: Db,
  partnerId: string,
  data: { key: string; label: string; color: string; sortOrder: number },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.partnerColumns).values({ id, partnerId, ...data });
  const [row] = await db.select().from(schema.partnerColumns).where(eq(schema.partnerColumns.id, id)).limit(1);
  return row!;
}

export async function updateColumn(
  db: Db,
  columnId: string,
  data: Partial<{ label: string; color: string; sortOrder: number }>,
) {
  await db.update(schema.partnerColumns).set(data).where(eq(schema.partnerColumns.id, columnId));
  const [row] = await db.select().from(schema.partnerColumns).where(eq(schema.partnerColumns.id, columnId)).limit(1);
  return row!;
}

export async function deleteColumn(db: Db, columnId: string) {
  await db.delete(schema.partnerColumns).where(eq(schema.partnerColumns.id, columnId));
}

export async function setMembers(db: Db, partnerId: string, userIds: string[]) {
  const targetIds = new Set(userIds);
  const now = nowIso();
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ userId: schema.partnerMembers.userId })
      .from(schema.partnerMembers)
      .where(eq(schema.partnerMembers.partnerId, partnerId));
    const currentIds = new Set(current.map((m) => m.userId));
    const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));

    if (toRemove.length) {
      await tx
        .delete(schema.partnerMembers)
        .where(and(eq(schema.partnerMembers.partnerId, partnerId), inArray(schema.partnerMembers.userId, toRemove)));
    }
    if (toAdd.length) {
      await tx.insert(schema.partnerMembers).values(
        toAdd.map((userId) => ({
          id: crypto.randomUUID(),
          partnerId,
          userId,
          role: "member",
          createdAt: now,
        })),
      );
    }
    return listMembers(tx, partnerId);
  });
}

export async function createTaskComment(db: Db, taskId: string, authorId: string, body: string) {
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.insert(schema.partnerTaskComments).values({
    id,
    taskId,
    authorId,
    body,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select({
      comment: schema.partnerTaskComments,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
    })
    .from(schema.partnerTaskComments)
    .innerJoin(commentAuthor, eq(schema.partnerTaskComments.authorId, commentAuthor.id))
    .where(eq(schema.partnerTaskComments.id, id))
    .limit(1);
  return {
    ...row!.comment,
    author: { id: row!.authorId, name: row!.authorName, email: row!.authorEmail },
  };
}

export async function listTaskResources(db: Db, taskId: string) {
  return db
    .select()
    .from(schema.partnerTaskResources)
    .where(eq(schema.partnerTaskResources.taskId, taskId))
    .orderBy(asc(schema.partnerTaskResources.createdAt));
}

export async function findTaskResource(db: Db, resourceId: string) {
  const [row] = await db
    .select()
    .from(schema.partnerTaskResources)
    .where(eq(schema.partnerTaskResources.id, resourceId))
    .limit(1);
  return row ?? null;
}

export async function addTaskResource(
  db: Db,
  taskId: string,
  data: { kind: string; label: string; url: string; createdBy: string },
) {
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.insert(schema.partnerTaskResources).values({
    id,
    taskId,
    kind: data.kind,
    label: data.label,
    url: data.url,
    createdBy: data.createdBy,
    createdAt: now,
  });
  const [row] = await db.select().from(schema.partnerTaskResources).where(eq(schema.partnerTaskResources.id, id)).limit(1);
  return row!;
}

export async function removeTaskResource(db: Db, resourceId: string) {
  await db.delete(schema.partnerTaskResources).where(eq(schema.partnerTaskResources.id, resourceId));
}

export async function setTaskAssignees(
  db: Db,
  taskId: string,
  assignees: { userId: string; allocationPct?: number | null }[],
) {
  const now = nowIso();
  return db.transaction(async (tx) => {
    await tx.delete(schema.partnerTaskAssignees).where(eq(schema.partnerTaskAssignees.taskId, taskId));
    if (assignees.length) {
      await tx.insert(schema.partnerTaskAssignees).values(
        assignees.map((a) => ({
          id: crypto.randomUUID(),
          taskId,
          userId: a.userId,
          allocationPct: a.allocationPct ?? null,
          createdAt: now,
        })),
      );
    }
    return loadTaskAssignees(tx, taskId);
  });
}
