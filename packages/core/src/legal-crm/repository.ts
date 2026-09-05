import { and, asc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbTransaction } from "@nexora/db";

type DbLike = Db | DbTransaction;
import { schema } from "@nexora/db";

const memberUser = alias(schema.users, "legal_member_user");
const taskOwner = alias(schema.users, "legal_task_owner");
const assigneeUser = alias(schema.users, "legal_task_assignee_user");
const commentAuthor = alias(schema.users, "legal_comment_author");

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

export async function requireProject(db: Db, idOrSlug: string) {
  const [row] = await db
    .select({
      id: schema.legalProjects.id,
      slug: schema.legalProjects.slug,
      name: schema.legalProjects.name,
      ownerId: schema.legalProjects.ownerId,
    })
    .from(schema.legalProjects)
    .where(or(eq(schema.legalProjects.id, idOrSlug), eq(schema.legalProjects.slug, idOrSlug)))
    .limit(1);
  return row ?? null;
}

export async function listColumns(db: Db, projectId: string) {
  return db
    .select()
    .from(schema.legalProjectColumns)
    .where(eq(schema.legalProjectColumns.projectId, projectId))
    .orderBy(asc(schema.legalProjectColumns.sortOrder), asc(schema.legalProjectColumns.key));
}

export async function seedDefaultColumns(db: Db, projectId: string) {
  await db
    .insert(schema.legalProjectColumns)
    .values(
      DEFAULT_COLUMNS.map((c) => ({
        id: crypto.randomUUID(),
        projectId,
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
      userId: schema.legalProjectTaskAssignees.userId,
      allocationPct: schema.legalProjectTaskAssignees.allocationPct,
      name: assigneeUser.name,
      email: assigneeUser.email,
    })
    .from(schema.legalProjectTaskAssignees)
    .innerJoin(assigneeUser, eq(schema.legalProjectTaskAssignees.userId, assigneeUser.id))
    .where(eq(schema.legalProjectTaskAssignees.taskId, taskId));
  return rows.map((r) => ({
    userId: r.userId,
    allocationPct: r.allocationPct,
    user: { id: r.userId, name: r.name, email: r.email },
  }));
}

export async function listTasksWithRelations(db: Db, projectId: string) {
  const tasks = await db
    .select({
      task: schema.legalProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.legalProjectTasks)
    .leftJoin(taskOwner, eq(schema.legalProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.legalProjectTasks.projectId, projectId))
    .orderBy(asc(schema.legalProjectTasks.sortOrder), asc(schema.legalProjectTasks.createdAt));

  return Promise.all(
    tasks.map(async (row) => {
      const assignees = await loadTaskAssignees(db, row.task.id);
      return {
        ...row.task,
        owner: row.ownerId ? { id: row.ownerId, name: row.ownerName!, email: row.ownerEmail! } : null,
        assignees,
      };
    }),
  );
}

export async function listMembers(db: DbLike, projectId: string) {
  const rows = await db
    .select({
      member: schema.legalProjectMembers,
      userId: memberUser.id,
      userName: memberUser.name,
      userEmail: memberUser.email,
    })
    .from(schema.legalProjectMembers)
    .innerJoin(memberUser, eq(schema.legalProjectMembers.userId, memberUser.id))
    .where(eq(schema.legalProjectMembers.projectId, projectId))
    .orderBy(asc(schema.legalProjectMembers.createdAt));
  return rows.map((r) => ({
    ...r.member,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}

export async function findTask(db: Db, taskId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.legalProjectTasks.id, projectId: schema.legalProjectTasks.projectId })
    .from(schema.legalProjectTasks)
    .where(and(eq(schema.legalProjectTasks.id, taskId), eq(schema.legalProjectTasks.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function findParentTask(db: Db, parentTaskId: string) {
  const [row] = await db
    .select({ id: schema.legalProjectTasks.id, projectId: schema.legalProjectTasks.projectId })
    .from(schema.legalProjectTasks)
    .where(eq(schema.legalProjectTasks.id, parentTaskId))
    .limit(1);
  return row ?? null;
}

export async function findColumn(db: Db, columnId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.legalProjectColumns.id, projectId: schema.legalProjectColumns.projectId })
    .from(schema.legalProjectColumns)
    .where(and(eq(schema.legalProjectColumns.id, columnId), eq(schema.legalProjectColumns.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function loadTaskDetail(db: DbLike, taskId: string) {
  const [row] = await db
    .select({
      task: schema.legalProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.legalProjectTasks)
    .leftJoin(taskOwner, eq(schema.legalProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.legalProjectTasks.id, taskId))
    .limit(1);
  if (!row) return null;
  const assignees = await loadTaskAssignees(db, taskId);
  return {
    ...row.task,
    owner: row.ownerId ? { id: row.ownerId, name: row.ownerName!, email: row.ownerEmail! } : null,
    assignees,
  };
}

export async function createTask(
  db: Db,
  projectId: string,
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
    await tx.insert(schema.legalProjectTasks).values({
      id,
      projectId,
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
      await tx.insert(schema.legalProjectTaskAssignees).values(
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
    const patch: Partial<typeof schema.legalProjectTasks.$inferInsert> = { updatedAt: now };
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.ownerId !== undefined) patch.ownerId = data.ownerId;
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;

    await tx.update(schema.legalProjectTasks).set(patch).where(eq(schema.legalProjectTasks.id, taskId));

    if (data.assigneeIds !== undefined) {
      await tx.delete(schema.legalProjectTaskAssignees).where(eq(schema.legalProjectTaskAssignees.taskId, taskId));
      if (data.assigneeIds.length) {
        await tx.insert(schema.legalProjectTaskAssignees).values(
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
  await db.delete(schema.legalProjectTasks).where(eq(schema.legalProjectTasks.id, taskId));
}

export async function createColumn(
  db: Db,
  projectId: string,
  data: { key: string; label: string; color: string; sortOrder: number },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.legalProjectColumns).values({ id, projectId, ...data });
  const [row] = await db.select().from(schema.legalProjectColumns).where(eq(schema.legalProjectColumns.id, id)).limit(1);
  return row!;
}

export async function updateColumn(
  db: Db,
  columnId: string,
  data: Partial<{ label: string; color: string; sortOrder: number }>,
) {
  await db.update(schema.legalProjectColumns).set(data).where(eq(schema.legalProjectColumns.id, columnId));
  const [row] = await db.select().from(schema.legalProjectColumns).where(eq(schema.legalProjectColumns.id, columnId)).limit(1);
  return row!;
}

export async function deleteColumn(db: Db, columnId: string) {
  await db.delete(schema.legalProjectColumns).where(eq(schema.legalProjectColumns.id, columnId));
}

export async function setMembers(db: Db, projectId: string, userIds: string[]) {
  const targetIds = new Set(userIds);
  const now = nowIso();
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ userId: schema.legalProjectMembers.userId })
      .from(schema.legalProjectMembers)
      .where(eq(schema.legalProjectMembers.projectId, projectId));
    const currentIds = new Set(current.map((m) => m.userId));
    const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));

    if (toRemove.length) {
      await tx
        .delete(schema.legalProjectMembers)
        .where(and(eq(schema.legalProjectMembers.projectId, projectId), inArray(schema.legalProjectMembers.userId, toRemove)));
    }
    if (toAdd.length) {
      await tx.insert(schema.legalProjectMembers).values(
        toAdd.map((userId) => ({
          id: crypto.randomUUID(),
          projectId,
          userId,
          role: "member",
          createdAt: now,
        })),
      );
    }
    return listMembers(tx, projectId);
  });
}

export async function createTaskComment(db: Db, taskId: string, authorId: string, body: string) {
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.insert(schema.legalProjectTaskComments).values({
    id,
    taskId,
    authorId,
    body,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select({
      comment: schema.legalProjectTaskComments,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
    })
    .from(schema.legalProjectTaskComments)
    .innerJoin(commentAuthor, eq(schema.legalProjectTaskComments.authorId, commentAuthor.id))
    .where(eq(schema.legalProjectTaskComments.id, id))
    .limit(1);
  return {
    ...row!.comment,
    author: { id: row!.authorId, name: row!.authorName, email: row!.authorEmail },
  };
}

export async function setTaskAssignees(
  db: Db,
  taskId: string,
  assignees: { userId: string; allocationPct?: number | null }[],
) {
  const now = nowIso();
  return db.transaction(async (tx) => {
    await tx.delete(schema.legalProjectTaskAssignees).where(eq(schema.legalProjectTaskAssignees.taskId, taskId));
    if (assignees.length) {
      await tx.insert(schema.legalProjectTaskAssignees).values(
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