import { and, asc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbTransaction } from "@nexora/db";

type DbLike = Db | DbTransaction;
import { schema } from "@nexora/db";

const memberUser = alias(schema.users, "qa_member_user");
const taskOwner = alias(schema.users, "qa_task_owner");
const assigneeUser = alias(schema.users, "qa_task_assignee_user");
const commentAuthor = alias(schema.users, "qa_comment_author");

export const DEFAULT_COLUMNS = [
  { key: "open", label: "Open", color: "bg-blue-500", sortOrder: 0 },
  { key: "clarified", label: "Clarified", color: "bg-amber-500", sortOrder: 1 },
  { key: "exception", label: "Exception", color: "bg-purple-500", sortOrder: 2 },
  { key: "closed", label: "Closed", color: "bg-emerald-500", sortOrder: 3 },
] as const;

function nowIso() {
  return new Date().toISOString();
}

export async function requireProject(db: Db, idOrSlug: string) {
  const [row] = await db
    .select({
      id: schema.qaProjects.id,
      slug: schema.qaProjects.slug,
      name: schema.qaProjects.name,
      ownerId: schema.qaProjects.ownerId,
    })
    .from(schema.qaProjects)
    .where(or(eq(schema.qaProjects.id, idOrSlug), eq(schema.qaProjects.slug, idOrSlug)))
    .limit(1);
  return row ?? null;
}

export async function listColumns(db: Db, projectId: string) {
  return db
    .select()
    .from(schema.qaProjectColumns)
    .where(eq(schema.qaProjectColumns.projectId, projectId))
    .orderBy(asc(schema.qaProjectColumns.sortOrder), asc(schema.qaProjectColumns.key));
}

export async function seedDefaultColumns(db: Db, projectId: string) {
  await db
    .insert(schema.qaProjectColumns)
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
      userId: schema.qaProjectTaskAssignees.userId,
      allocationPct: schema.qaProjectTaskAssignees.allocationPct,
      name: assigneeUser.name,
      email: assigneeUser.email,
    })
    .from(schema.qaProjectTaskAssignees)
    .innerJoin(assigneeUser, eq(schema.qaProjectTaskAssignees.userId, assigneeUser.id))
    .where(eq(schema.qaProjectTaskAssignees.taskId, taskId));
  return rows.map((r) => ({
    userId: r.userId,
    allocationPct: r.allocationPct,
    user: { id: r.userId, name: r.name, email: r.email },
  }));
}

export async function listTasksWithRelations(db: Db, projectId: string) {
  const tasks = await db
    .select({
      task: schema.qaProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.qaProjectTasks)
    .leftJoin(taskOwner, eq(schema.qaProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.qaProjectTasks.projectId, projectId))
    .orderBy(asc(schema.qaProjectTasks.sortOrder), asc(schema.qaProjectTasks.createdAt));

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
      member: schema.qaProjectMembers,
      userId: memberUser.id,
      userName: memberUser.name,
      userEmail: memberUser.email,
    })
    .from(schema.qaProjectMembers)
    .innerJoin(memberUser, eq(schema.qaProjectMembers.userId, memberUser.id))
    .where(eq(schema.qaProjectMembers.projectId, projectId))
    .orderBy(asc(schema.qaProjectMembers.createdAt));
  return rows.map((r) => ({
    ...r.member,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}

export async function findTask(db: Db, taskId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.qaProjectTasks.id, projectId: schema.qaProjectTasks.projectId })
    .from(schema.qaProjectTasks)
    .where(and(eq(schema.qaProjectTasks.id, taskId), eq(schema.qaProjectTasks.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function findParentTask(db: Db, parentTaskId: string) {
  const [row] = await db
    .select({ id: schema.qaProjectTasks.id, projectId: schema.qaProjectTasks.projectId })
    .from(schema.qaProjectTasks)
    .where(eq(schema.qaProjectTasks.id, parentTaskId))
    .limit(1);
  return row ?? null;
}

export async function findColumn(db: Db, columnId: string, projectId: string) {
  const [row] = await db
    .select({ id: schema.qaProjectColumns.id, projectId: schema.qaProjectColumns.projectId })
    .from(schema.qaProjectColumns)
    .where(and(eq(schema.qaProjectColumns.id, columnId), eq(schema.qaProjectColumns.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function loadTaskDetail(db: DbLike, taskId: string) {
  const [row] = await db
    .select({
      task: schema.qaProjectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.qaProjectTasks)
    .leftJoin(taskOwner, eq(schema.qaProjectTasks.ownerId, taskOwner.id))
    .where(eq(schema.qaProjectTasks.id, taskId))
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
    issueDate?: string | null;
    partner?: string | null;
    product?: string | null;
    issueType?: string | null;
    observation?: string | null;
    expectation?: string | null;
    eta?: string | null;
    qaComment?: string | null;
  },
) {
  const id = crypto.randomUUID();
  const now = nowIso();
  return db.transaction(async (tx) => {
    await tx.insert(schema.qaProjectTasks).values({
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
      issueDate: data.issueDate ?? null,
      partner: data.partner ?? null,
      product: data.product ?? null,
      issueType: data.issueType ?? null,
      observation: data.observation ?? null,
      expectation: data.expectation ?? null,
      eta: data.eta ?? null,
      qaComment: data.qaComment ?? null,
      createdAt: now,
      updatedAt: now,
    });
    if (data.assigneeIds?.length) {
      await tx.insert(schema.qaProjectTaskAssignees).values(
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
    const patch: Partial<typeof schema.qaProjectTasks.$inferInsert> = { updatedAt: now };
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.ownerId !== undefined) patch.ownerId = data.ownerId;
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
    if ((data as { issueDate?: string | null }).issueDate !== undefined) {
      patch.issueDate = (data as { issueDate?: string | null }).issueDate ?? null;
    }
    if ((data as { partner?: string | null }).partner !== undefined) patch.partner = (data as { partner?: string | null }).partner;
    if ((data as { product?: string | null }).product !== undefined) patch.product = (data as { product?: string | null }).product;
    if ((data as { issueType?: string | null }).issueType !== undefined) patch.issueType = (data as { issueType?: string | null }).issueType;
    if ((data as { observation?: string | null }).observation !== undefined) patch.observation = (data as { observation?: string | null }).observation;
    if ((data as { expectation?: string | null }).expectation !== undefined) patch.expectation = (data as { expectation?: string | null }).expectation;
    if ((data as { eta?: string | null }).eta !== undefined) patch.eta = (data as { eta?: string | null }).eta;
    if ((data as { qaComment?: string | null }).qaComment !== undefined) patch.qaComment = (data as { qaComment?: string | null }).qaComment;

    await tx.update(schema.qaProjectTasks).set(patch).where(eq(schema.qaProjectTasks.id, taskId));

    if (data.assigneeIds !== undefined) {
      await tx.delete(schema.qaProjectTaskAssignees).where(eq(schema.qaProjectTaskAssignees.taskId, taskId));
      if (data.assigneeIds.length) {
        await tx.insert(schema.qaProjectTaskAssignees).values(
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
  await db.delete(schema.qaProjectTasks).where(eq(schema.qaProjectTasks.id, taskId));
}

export async function createColumn(
  db: Db,
  projectId: string,
  data: { key: string; label: string; color: string; sortOrder: number },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.qaProjectColumns).values({ id, projectId, ...data });
  const [row] = await db.select().from(schema.qaProjectColumns).where(eq(schema.qaProjectColumns.id, id)).limit(1);
  return row!;
}

export async function updateColumn(
  db: Db,
  columnId: string,
  data: Partial<{ label: string; color: string; sortOrder: number }>,
) {
  await db.update(schema.qaProjectColumns).set(data).where(eq(schema.qaProjectColumns.id, columnId));
  const [row] = await db.select().from(schema.qaProjectColumns).where(eq(schema.qaProjectColumns.id, columnId)).limit(1);
  return row!;
}

export async function deleteColumn(db: Db, columnId: string) {
  await db.delete(schema.qaProjectColumns).where(eq(schema.qaProjectColumns.id, columnId));
}

export async function setMembers(db: Db, projectId: string, userIds: string[]) {
  const targetIds = new Set(userIds);
  const now = nowIso();
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ userId: schema.qaProjectMembers.userId })
      .from(schema.qaProjectMembers)
      .where(eq(schema.qaProjectMembers.projectId, projectId));
    const currentIds = new Set(current.map((m) => m.userId));
    const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));

    if (toRemove.length) {
      await tx
        .delete(schema.qaProjectMembers)
        .where(and(eq(schema.qaProjectMembers.projectId, projectId), inArray(schema.qaProjectMembers.userId, toRemove)));
    }
    if (toAdd.length) {
      await tx.insert(schema.qaProjectMembers).values(
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
  await db.insert(schema.qaProjectTaskComments).values({
    id,
    taskId,
    authorId,
    body,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select({
      comment: schema.qaProjectTaskComments,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
    })
    .from(schema.qaProjectTaskComments)
    .innerJoin(commentAuthor, eq(schema.qaProjectTaskComments.authorId, commentAuthor.id))
    .where(eq(schema.qaProjectTaskComments.id, id))
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
    await tx.delete(schema.qaProjectTaskAssignees).where(eq(schema.qaProjectTaskAssignees.taskId, taskId));
    if (assignees.length) {
      await tx.insert(schema.qaProjectTaskAssignees).values(
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