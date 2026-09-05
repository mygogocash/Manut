import { and, asc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbTransaction } from "@nexora/db";

type DbLike = Db | DbTransaction;
import { schema } from "@nexora/db";

const memberUser = alias(schema.users, "product_member_user");
const taskOwner = alias(schema.users, "product_task_owner");
const assigneeUser = alias(schema.users, "product_task_assignee_user");
const commentAuthor = alias(schema.users, "product_comment_author");

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
      id: schema.productProjects.id,
      slug: schema.productProjects.slug,
      name: schema.productProjects.name,
      ownerId: schema.productProjects.ownerId,
    })
    .from(schema.productProjects)
    .where(or(eq(schema.productProjects.id, idOrSlug), eq(schema.productProjects.slug, idOrSlug)))
    .limit(1);
  return row ?? null;
}

export async function listColumns(db: Db, projectId: string) {
  return db
    .select()
    .from(schema.productProjectColumns)
    .where(eq(schema.productProjectColumns.projectId, projectId))
    .orderBy(asc(schema.productProjectColumns.sortOrder), asc(schema.productProjectColumns.key));
}

export async function seedDefaultColumns(db: Db, projectId: string) {
  await db
    .insert(schema.productProjectColumns)
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
      userId: schema.productProjectTaskAssignees.userId,
      allocationPct: schema.productProjectTaskAssignees.allocationPct,
      name: assigneeUser.name,
      email: assigneeUser.email,
    })
    .from(schema.productProjectTaskAssignees)
    .innerJoin(assigneeUser, eq(schema.productProjectTaskAssignees.userId, assigneeUser.id))
    .where(eq(schema.productProjectTaskAssignees.taskId, taskId));
  return rows.map((r) => ({
    userId: r.userId,
    allocationPct: r.allocationPct,
    user: { id: r.userId, name: r.name, email: r.email },
  }));
}

export async function listTasksWithRelations(db: Db, projectId: string) {
  const tasks = await db
    .select({
      task: schema.productProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.productProjectTasks)
    .leftJoin(taskOwner, eq(schema.productProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.productProjectTasks.projectId, projectId))
    .orderBy(asc(schema.productProjectTasks.sortOrder), asc(schema.productProjectTasks.createdAt));

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
      member: schema.productProjectMembers,
      userId: memberUser.id,
      userName: memberUser.name,
      userEmail: memberUser.email,
    })
    .from(schema.productProjectMembers)
    .innerJoin(memberUser, eq(schema.productProjectMembers.userId, memberUser.id))
    .where(eq(schema.productProjectMembers.projectId, projectId))
    .orderBy(asc(schema.productProjectMembers.createdAt));
  return rows.map((r) => ({
    ...r.member,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}

export async function findTask(db: Db, taskId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.productProjectTasks.id, projectId: schema.productProjectTasks.projectId })
    .from(schema.productProjectTasks)
    .where(and(eq(schema.productProjectTasks.id, taskId), eq(schema.productProjectTasks.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function findParentTask(db: Db, parentTaskId: string) {
  const [row] = await db
    .select({ id: schema.productProjectTasks.id, projectId: schema.productProjectTasks.projectId })
    .from(schema.productProjectTasks)
    .where(eq(schema.productProjectTasks.id, parentTaskId))
    .limit(1);
  return row ?? null;
}

export async function findColumn(db: Db, columnId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.productProjectColumns.id, projectId: schema.productProjectColumns.projectId })
    .from(schema.productProjectColumns)
    .where(and(eq(schema.productProjectColumns.id, columnId), eq(schema.productProjectColumns.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function loadTaskDetail(db: DbLike, taskId: string) {
  const [row] = await db
    .select({
      task: schema.productProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.productProjectTasks)
    .leftJoin(taskOwner, eq(schema.productProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.productProjectTasks.id, taskId))
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
    await tx.insert(schema.productProjectTasks).values({
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
      await tx.insert(schema.productProjectTaskAssignees).values(
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
    const patch: Partial<typeof schema.productProjectTasks.$inferInsert> = { updatedAt: now };
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.ownerId !== undefined) patch.ownerId = data.ownerId;
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;

    await tx.update(schema.productProjectTasks).set(patch).where(eq(schema.productProjectTasks.id, taskId));

    if (data.assigneeIds !== undefined) {
      await tx.delete(schema.productProjectTaskAssignees).where(eq(schema.productProjectTaskAssignees.taskId, taskId));
      if (data.assigneeIds.length) {
        await tx.insert(schema.productProjectTaskAssignees).values(
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
  await db.delete(schema.productProjectTasks).where(eq(schema.productProjectTasks.id, taskId));
}

export async function createColumn(
  db: Db,
  projectId: string,
  data: { key: string; label: string; color: string; sortOrder: number },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.productProjectColumns).values({ id, projectId, ...data });
  const [row] = await db.select().from(schema.productProjectColumns).where(eq(schema.productProjectColumns.id, id)).limit(1);
  return row!;
}

export async function updateColumn(
  db: Db,
  columnId: string,
  data: Partial<{ label: string; color: string; sortOrder: number }>,
) {
  await db.update(schema.productProjectColumns).set(data).where(eq(schema.productProjectColumns.id, columnId));
  const [row] = await db.select().from(schema.productProjectColumns).where(eq(schema.productProjectColumns.id, columnId)).limit(1);
  return row!;
}

export async function deleteColumn(db: Db, columnId: string) {
  await db.delete(schema.productProjectColumns).where(eq(schema.productProjectColumns.id, columnId));
}

export async function setMembers(db: Db, projectId: string, userIds: string[]) {
  const targetIds = new Set(userIds);
  const now = nowIso();
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ userId: schema.productProjectMembers.userId })
      .from(schema.productProjectMembers)
      .where(eq(schema.productProjectMembers.projectId, projectId));
    const currentIds = new Set(current.map((m) => m.userId));
    const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));

    if (toRemove.length) {
      await tx
        .delete(schema.productProjectMembers)
        .where(and(eq(schema.productProjectMembers.projectId, projectId), inArray(schema.productProjectMembers.userId, toRemove)));
    }
    if (toAdd.length) {
      await tx.insert(schema.productProjectMembers).values(
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
  await db.insert(schema.productProjectTaskComments).values({
    id,
    taskId,
    authorId,
    body,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select({
      comment: schema.productProjectTaskComments,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
    })
    .from(schema.productProjectTaskComments)
    .innerJoin(commentAuthor, eq(schema.productProjectTaskComments.authorId, commentAuthor.id))
    .where(eq(schema.productProjectTaskComments.id, id))
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
    await tx.delete(schema.productProjectTaskAssignees).where(eq(schema.productProjectTaskAssignees.taskId, taskId));
    if (assignees.length) {
      await tx.insert(schema.productProjectTaskAssignees).values(
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