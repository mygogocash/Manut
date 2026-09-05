import { and, asc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbTransaction } from "@nexora/db";

type DbLike = Db | DbTransaction;
import { schema } from "@nexora/db";

const memberUser = alias(schema.users, "it_member_user");
const taskOwner = alias(schema.users, "it_task_owner");
const assigneeUser = alias(schema.users, "it_task_assignee_user");
const commentAuthor = alias(schema.users, "it_comment_author");

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
      id: schema.itProjects.id,
      slug: schema.itProjects.slug,
      name: schema.itProjects.name,
      ownerId: schema.itProjects.ownerId,
    })
    .from(schema.itProjects)
    .where(or(eq(schema.itProjects.id, idOrSlug), eq(schema.itProjects.slug, idOrSlug)))
    .limit(1);
  return row ?? null;
}

export async function listColumns(db: Db, projectId: string) {
  return db
    .select()
    .from(schema.itProjectColumns)
    .where(eq(schema.itProjectColumns.projectId, projectId))
    .orderBy(asc(schema.itProjectColumns.sortOrder), asc(schema.itProjectColumns.key));
}

export async function seedDefaultColumns(db: Db, projectId: string) {
  await db
    .insert(schema.itProjectColumns)
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
      userId: schema.itProjectTaskAssignees.userId,
      allocationPct: schema.itProjectTaskAssignees.allocationPct,
      name: assigneeUser.name,
      email: assigneeUser.email,
    })
    .from(schema.itProjectTaskAssignees)
    .innerJoin(assigneeUser, eq(schema.itProjectTaskAssignees.userId, assigneeUser.id))
    .where(eq(schema.itProjectTaskAssignees.taskId, taskId));
  return rows.map((r) => ({
    userId: r.userId,
    allocationPct: r.allocationPct,
    user: { id: r.userId, name: r.name, email: r.email },
  }));
}

export async function listTasksWithRelations(db: Db, projectId: string) {
  const tasks = await db
    .select({
      task: schema.itProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.itProjectTasks)
    .leftJoin(taskOwner, eq(schema.itProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.itProjectTasks.projectId, projectId))
    .orderBy(asc(schema.itProjectTasks.sortOrder), asc(schema.itProjectTasks.createdAt));

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
      member: schema.itProjectMembers,
      userId: memberUser.id,
      userName: memberUser.name,
      userEmail: memberUser.email,
    })
    .from(schema.itProjectMembers)
    .innerJoin(memberUser, eq(schema.itProjectMembers.userId, memberUser.id))
    .where(eq(schema.itProjectMembers.projectId, projectId))
    .orderBy(asc(schema.itProjectMembers.createdAt));
  return rows.map((r) => ({
    ...r.member,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}

export async function findTask(db: Db, taskId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.itProjectTasks.id, projectId: schema.itProjectTasks.projectId })
    .from(schema.itProjectTasks)
    .where(and(eq(schema.itProjectTasks.id, taskId), eq(schema.itProjectTasks.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function findParentTask(db: Db, parentTaskId: string) {
  const [row] = await db
    .select({ id: schema.itProjectTasks.id, projectId: schema.itProjectTasks.projectId })
    .from(schema.itProjectTasks)
    .where(eq(schema.itProjectTasks.id, parentTaskId))
    .limit(1);
  return row ?? null;
}

export async function findColumn(db: Db, columnId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.itProjectColumns.id, projectId: schema.itProjectColumns.projectId })
    .from(schema.itProjectColumns)
    .where(and(eq(schema.itProjectColumns.id, columnId), eq(schema.itProjectColumns.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function loadTaskDetail(db: DbLike, taskId: string) {
  const [row] = await db
    .select({
      task: schema.itProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.itProjectTasks)
    .leftJoin(taskOwner, eq(schema.itProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.itProjectTasks.id, taskId))
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
    await tx.insert(schema.itProjectTasks).values({
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
      await tx.insert(schema.itProjectTaskAssignees).values(
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
    const patch: Partial<typeof schema.itProjectTasks.$inferInsert> = { updatedAt: now };
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.ownerId !== undefined) patch.ownerId = data.ownerId;
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;

    await tx.update(schema.itProjectTasks).set(patch).where(eq(schema.itProjectTasks.id, taskId));

    if (data.assigneeIds !== undefined) {
      await tx.delete(schema.itProjectTaskAssignees).where(eq(schema.itProjectTaskAssignees.taskId, taskId));
      if (data.assigneeIds.length) {
        await tx.insert(schema.itProjectTaskAssignees).values(
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
  await db.delete(schema.itProjectTasks).where(eq(schema.itProjectTasks.id, taskId));
}

export async function createColumn(
  db: Db,
  projectId: string,
  data: { key: string; label: string; color: string; sortOrder: number },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.itProjectColumns).values({ id, projectId, ...data });
  const [row] = await db.select().from(schema.itProjectColumns).where(eq(schema.itProjectColumns.id, id)).limit(1);
  return row!;
}

export async function updateColumn(
  db: Db,
  columnId: string,
  data: Partial<{ label: string; color: string; sortOrder: number }>,
) {
  await db.update(schema.itProjectColumns).set(data).where(eq(schema.itProjectColumns.id, columnId));
  const [row] = await db.select().from(schema.itProjectColumns).where(eq(schema.itProjectColumns.id, columnId)).limit(1);
  return row!;
}

export async function deleteColumn(db: Db, columnId: string) {
  await db.delete(schema.itProjectColumns).where(eq(schema.itProjectColumns.id, columnId));
}

export async function setMembers(db: Db, projectId: string, userIds: string[]) {
  const targetIds = new Set(userIds);
  const now = nowIso();
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ userId: schema.itProjectMembers.userId })
      .from(schema.itProjectMembers)
      .where(eq(schema.itProjectMembers.projectId, projectId));
    const currentIds = new Set(current.map((m) => m.userId));
    const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));

    if (toRemove.length) {
      await tx
        .delete(schema.itProjectMembers)
        .where(and(eq(schema.itProjectMembers.projectId, projectId), inArray(schema.itProjectMembers.userId, toRemove)));
    }
    if (toAdd.length) {
      await tx.insert(schema.itProjectMembers).values(
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
  await db.insert(schema.itProjectTaskComments).values({
    id,
    taskId,
    authorId,
    body,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select({
      comment: schema.itProjectTaskComments,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
    })
    .from(schema.itProjectTaskComments)
    .innerJoin(commentAuthor, eq(schema.itProjectTaskComments.authorId, commentAuthor.id))
    .where(eq(schema.itProjectTaskComments.id, id))
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
    await tx.delete(schema.itProjectTaskAssignees).where(eq(schema.itProjectTaskAssignees.taskId, taskId));
    if (assignees.length) {
      await tx.insert(schema.itProjectTaskAssignees).values(
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