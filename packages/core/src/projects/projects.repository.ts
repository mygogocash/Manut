import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNotNull,
  isNull,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";
import { createCuid } from "../lib/id";
import { mirrorNativeProjectIfNeeded } from "./mirror-native";

const ownerUser = alias(schema.users, "project_owner");
const partnerRow = alias(schema.partners, "project_partner");
const memberUser = alias(schema.users, "project_member_user");
const taskOwner = alias(schema.users, "project_task_owner");
const assigneeUser = alias(schema.users, "project_assignee_user");
const milestoneOwner = alias(schema.users, "project_milestone_owner");

export type ProjectListFilters = {
  status?: string;
  search?: string;
  team?: string;
  department?: string;
  agreement?: string;
  partnerId?: string;
  archived?: boolean;
  accessibleByUserId?: string;
};

async function loadMembers(db: Db, projectId: string) {
  const rows = await db
    .select({
      id: schema.projectMembers.id,
      userId: schema.projectMembers.userId,
      role: schema.projectMembers.role,
      userName: memberUser.name,
      userEmail: memberUser.email,
    })
    .from(schema.projectMembers)
    .innerJoin(memberUser, eq(schema.projectMembers.userId, memberUser.id))
    .where(eq(schema.projectMembers.projectId, projectId));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    role: r.role,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}

async function loadColumns(db: Db, projectId: string) {
  return db
    .select()
    .from(schema.projectColumns)
    .where(eq(schema.projectColumns.projectId, projectId))
    .orderBy(asc(schema.projectColumns.sortOrder));
}

async function loadMilestones(db: Db, projectId: string) {
  const rows = await db
    .select({
      ms: schema.projectMilestones,
      ownerId: milestoneOwner.id,
      ownerName: milestoneOwner.name,
      ownerEmail: milestoneOwner.email,
    })
    .from(schema.projectMilestones)
    .leftJoin(milestoneOwner, eq(schema.projectMilestones.ownerId, milestoneOwner.id))
    .where(eq(schema.projectMilestones.projectId, projectId))
    .orderBy(asc(schema.projectMilestones.sortOrder));
  return rows.map((r) => ({
    ...r.ms,
    owner: r.ownerId ? { id: r.ownerId, name: r.ownerName!, email: r.ownerEmail! } : null,
  }));
}

async function loadTopLevelTasks(db: Db, projectId: string) {
  const tasks = await db
    .select({
      task: schema.projectTasks,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      ownerEmail: taskOwner.email,
    })
    .from(schema.projectTasks)
    .leftJoin(taskOwner, eq(schema.projectTasks.ownerId, taskOwner.id))
    .where(and(eq(schema.projectTasks.projectId, projectId), isNull(schema.projectTasks.parentTaskId)))
    .orderBy(asc(schema.projectTasks.sortOrder));

  return Promise.all(
    tasks.map(async (row) => {
      const assignees = await db
        .select({
          userId: schema.projectTaskAssignees.userId,
          allocationPct: schema.projectTaskAssignees.allocationPct,
          name: assigneeUser.name,
          email: assigneeUser.email,
        })
        .from(schema.projectTaskAssignees)
        .innerJoin(assigneeUser, eq(schema.projectTaskAssignees.userId, assigneeUser.id))
        .where(eq(schema.projectTaskAssignees.taskId, row.task.id));
      return {
        ...row.task,
        owner: row.ownerId ? { id: row.ownerId, name: row.ownerName!, email: row.ownerEmail! } : null,
        assignees: assignees.map((a) => ({
          userId: a.userId,
          allocationPct: a.allocationPct,
          user: { id: a.userId, name: a.name, email: a.email },
        })),
      };
    }),
  );
}

async function taskCount(db: Db, projectId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.projectTasks)
    .where(eq(schema.projectTasks.projectId, projectId));
  return Number(row?.n ?? 0);
}

async function loadProjectDetail(db: Db, projectId: string) {
  const [base] = await db
    .select({
      project: schema.projects,
      ownerId: ownerUser.id,
      ownerName: ownerUser.name,
      ownerEmail: ownerUser.email,
      partnerId: partnerRow.id,
      partnerCompany: partnerRow.company,
    })
    .from(schema.projects)
    .innerJoin(ownerUser, eq(schema.projects.ownerId, ownerUser.id))
    .leftJoin(partnerRow, eq(schema.projects.partnerId, partnerRow.id))
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  if (!base) return null;

  const [members, columns, milestones, tasks, tasksTotal] = await Promise.all([
    loadMembers(db, projectId),
    loadColumns(db, projectId),
    loadMilestones(db, projectId),
    loadTopLevelTasks(db, projectId),
    taskCount(db, projectId),
  ]);

  return {
    ...base.project,
    owner: { id: base.ownerId, name: base.ownerName, email: base.ownerEmail },
    partner: base.partnerId ? { id: base.partnerId, company: base.partnerCompany! } : null,
    members,
    columns,
    milestones,
    tasks,
    _count: { tasks: tasksTotal },
  };
}

function buildWhereWithDb(db: Db, filters: ProjectListFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.status) parts.push(eq(schema.projects.status, filters.status));
  if (filters.team) parts.push(eq(schema.projects.team, filters.team));
  if (filters.department) {
    parts.push(
      or(
        eq(schema.projects.department, filters.department),
        sql`${filters.department} = ANY(${schema.projects.departments})`,
      )!,
    );
  }
  if (filters.agreement) parts.push(eq(schema.projects.agreement, filters.agreement));
  if (filters.partnerId) parts.push(eq(schema.projects.partnerId, filters.partnerId));
  parts.push(filters.archived ? isNotNull(schema.projects.archivedAt) : isNull(schema.projects.archivedAt));
  if (filters.search) parts.push(ilike(schema.projects.name, `%${filters.search}%`));
  if (filters.accessibleByUserId) {
    const uid = filters.accessibleByUserId;
    parts.push(
      or(
        eq(schema.projects.ownerId, uid),
        exists(
          db
            .select({ x: sql`1` })
            .from(schema.projectMembers)
            .where(
              and(
                eq(schema.projectMembers.projectId, schema.projects.id),
                eq(schema.projectMembers.userId, uid),
              ),
            ),
        ),
      )!,
    );
  }
  return parts.length ? and(...parts) : undefined;
}

export async function findMany(db: Db, filters: ProjectListFilters, page: number, limit: number) {
  const where = buildWhereWithDb(db, filters);
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      project: schema.projects,
      ownerId: ownerUser.id,
      ownerName: ownerUser.name,
      ownerEmail: ownerUser.email,
      partnerId: partnerRow.id,
      partnerCompany: partnerRow.company,
    })
    .from(schema.projects)
    .innerJoin(ownerUser, eq(schema.projects.ownerId, ownerUser.id))
    .leftJoin(partnerRow, eq(schema.projects.partnerId, partnerRow.id))
    .where(where)
    .orderBy(asc(schema.projects.sortOrder), desc(schema.projects.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db.select({ n: count() }).from(schema.projects).where(where);
  const total = Number(totalRow?.n ?? 0);

  const data = await Promise.all(
    rows.map(async (r) => {
      const members = await loadMembers(db, r.project.id);
      const tasksTotal = await taskCount(db, r.project.id);
      return {
        ...r.project,
        owner: { id: r.ownerId, name: r.ownerName, email: r.ownerEmail },
        partner: r.partnerId ? { id: r.partnerId, company: r.partnerCompany! } : null,
        members,
        _count: { tasks: tasksTotal },
      };
    }),
  );

  return { data, total };
}

export async function findById(db: Db, id: string) {
  return loadProjectDetail(db, id);
}

export async function findBySlug(db: Db, slug: string) {
  const [row] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return row ? loadProjectDetail(db, row.id) : null;
}

export async function findParticipantRole(
  db: Db,
  projectId: string,
  userId: string,
): Promise<"owner" | "member" | null> {
  const [row] = await db
    .select({ ownerId: schema.projects.ownerId })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  if (!row) return null;
  if (row.ownerId === userId) return "owner";
  const [member] = await db
    .select({ id: schema.projectMembers.id })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)))
    .limit(1);
  return member ? "member" : null;
}

export { mirrorNativeProjectIfNeeded };


export const DEFAULT_COLUMNS = [
  { key: "backlog", label: "Backlog", color: "bg-zinc-500", sortOrder: 0 },
  { key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 1 },
  { key: "in_progress", label: "In Progress", color: "bg-amber-500", sortOrder: 2 },
  { key: "in_review", label: "In Review", color: "bg-purple-500", sortOrder: 3 },
  { key: "done", label: "Done", color: "bg-emerald-500", sortOrder: 4 },
] as const;

export async function findProjectMeta(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.projects.id,
      ownerId: schema.projects.ownerId,
      team: schema.projects.team,
      archivedAt: schema.projects.archivedAt,
      name: schema.projects.name,
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);
  return row ?? null;
}

export async function slugExists(db: Db, slug: string) {
  const [row] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return !!row;
}

export async function createProject(
  db: Db,
  data: {
    name: string;
    slug: string;
    ownerId: string;
    description?: string | null;
    status: string;
    team: string;
    startDate?: string | null;
    endDate?: string | null;
    budget?: string | null;
    customFields?: unknown;
    productionLiveDate?: string | null;
    goLiveDate?: string | null;
    revisedGoLiveDate?: string | null;
    agreement?: string | null;
    dependency?: string | null;
    comment?: string | null;
    department?: string | null;
    departments?: string[];
    workstream?: string | null;
    details?: string | null;
    taskType?: string | null;
    assignedTeam?: string | null;
    defaultAssigneeMode?: string;
    defaultAssigneeId?: string | null;
    partnerId?: string | null;
  },
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.projects).values({
    id,
    name: data.name,
    slug: data.slug,
    description: data.description ?? null,
    status: data.status,
    ownerId: data.ownerId,
    partnerId: data.partnerId ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    budget: data.budget ?? null,
    customFields: (data.customFields ?? []) as never,
    productionLiveDate: data.productionLiveDate ?? null,
    goLiveDate: data.goLiveDate ?? null,
    revisedGoLiveDate: data.revisedGoLiveDate ?? null,
    agreement: data.agreement ?? null,
    dependency: data.dependency ?? null,
    comment: data.comment ?? null,
    team: data.team,
    department: data.department ?? null,
    departments: data.departments ?? [],
    workstream: data.workstream ?? null,
    details: data.details ?? null,
    taskType: data.taskType ?? null,
    assignedTeam: data.assignedTeam ?? null,
    defaultAssigneeMode: data.defaultAssigneeMode ?? "none",
    defaultAssigneeId: data.defaultAssigneeMode === "user" ? data.defaultAssigneeId ?? null : null,
    createdAt: now,
    updatedAt: now,
  });
  for (const col of DEFAULT_COLUMNS) {
    await db.insert(schema.projectColumns).values({
      id: crypto.randomUUID(),
      projectId: id,
      key: col.key,
      label: col.label,
      color: col.color,
      sortOrder: col.sortOrder,
    });
  }
  return id;
}

export async function updateProject(db: Db, id: string, patch: Record<string, unknown>) {
  await db
    .update(schema.projects)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.projects.id, id));
}

export async function deleteProject(db: Db, id: string) {
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
}

export async function setMembers(db: Db, projectId: string, userIds: string[]) {
  await db.delete(schema.projectMembers).where(eq(schema.projectMembers.projectId, projectId));
  if (userIds.length === 0) return loadMembers(db, projectId);
  await db.insert(schema.projectMembers).values(
    userIds.map((userId) => ({
      id: crypto.randomUUID(),
      projectId,
      userId,
      role: "member",
    })),
  );
  return loadMembers(db, projectId);
}

export async function getMembers(db: Db, projectId: string) {
  return loadMembers(db, projectId);
}

export async function createColumn(
  db: Db,
  data: { projectId: string; key: string; label: string; color: string; sortOrder: number },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.projectColumns).values({ id, ...data });
  const [row] = await db.select().from(schema.projectColumns).where(eq(schema.projectColumns.id, id)).limit(1);
  return row!;
}

export async function updateColumn(db: Db, id: string, patch: Record<string, unknown>) {
  await db.update(schema.projectColumns).set(patch).where(eq(schema.projectColumns.id, id));
  const [row] = await db.select().from(schema.projectColumns).where(eq(schema.projectColumns.id, id)).limit(1);
  return row!;
}

export async function deleteColumn(db: Db, id: string) {
  await db.delete(schema.projectColumns).where(eq(schema.projectColumns.id, id));
}

export async function findTaskById(db: Db, id: string) {
  const [row] = await db.select().from(schema.projectTasks).where(eq(schema.projectTasks.id, id)).limit(1);
  return row ?? null;
}

export async function findMilestoneById(db: Db, id: string) {
  const [row] = await db.select().from(schema.projectMilestones).where(eq(schema.projectMilestones.id, id)).limit(1);
  return row ?? null;
}

export async function createTask(
  db: Db,
  data: {
    projectId: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    ownerId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    milestoneId?: string | null;
    sortOrder?: number;
    parentTaskId?: string | null;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.projectTasks).values({
    id,
    projectId: data.projectId,
    title: data.title,
    description: data.description ?? null,
    status: data.status,
    priority: data.priority,
    ownerId: data.ownerId ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    milestoneId: data.milestoneId ?? null,
    sortOrder: data.sortOrder ?? 0,
    parentTaskId: data.parentTaskId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return findTaskById(db, id);
}

export async function updateTask(db: Db, id: string, patch: Record<string, unknown>) {
  await db
    .update(schema.projectTasks)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.projectTasks.id, id));
  return findTaskById(db, id);
}

export async function deleteTask(db: Db, id: string) {
  await db.delete(schema.projectTasks).where(eq(schema.projectTasks.id, id));
}

export async function setAssignees(
  db: Db,
  taskId: string,
  rows: Array<{ userId: string; allocationPct?: number | null }>,
) {
  await db.delete(schema.projectTaskAssignees).where(eq(schema.projectTaskAssignees.taskId, taskId));
  if (rows.length > 0) {
    await db.insert(schema.projectTaskAssignees).values(
      rows.map((r) => ({
        id: crypto.randomUUID(),
        taskId,
        userId: r.userId,
        allocationPct: r.allocationPct ?? null,
      })),
    );
  }
}

export async function findTaskIdsInProject(db: Db, projectId: string, ids: string[]) {
  if (ids.length === 0) return [] as string[];
  const rows = await db
    .select({ id: schema.projectTasks.id })
    .from(schema.projectTasks)
    .where(and(eq(schema.projectTasks.projectId, projectId), inArray(schema.projectTasks.id, ids)));
  return rows.map((r) => r.id);
}

export async function applyTaskSortOrder(
  db: Db,
  items: Array<{ id: string; sortOrder: number }>,
  status?: string,
) {
  for (const item of items) {
    await db
      .update(schema.projectTasks)
      .set({
        sortOrder: item.sortOrder,
        ...(status ? { status } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.projectTasks.id, item.id));
  }
}

async function resolveDefaultAssignee(
  db: Db,
  cfg: { defaultAssigneeMode: string; defaultAssigneeId: string | null; ownerId: string },
  actorId: string,
): Promise<string | null> {
  switch (cfg.defaultAssigneeMode) {
    case "creator":
      return actorId;
    case "owner":
      return cfg.ownerId;
    case "user": {
      if (!cfg.defaultAssigneeId) return null;
      const [user] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.id, cfg.defaultAssigneeId),
            eq(schema.users.isActive, true),
            isNull(schema.users.deletedAt),
          ),
        )
        .limit(1);
      return user?.id ?? null;
    }
    default:
      return null;
  }
}

export async function resolveProjectDefaultAssignee(db: Db, projectId: string, actorId: string) {
  const [p] = await db
    .select({
      defaultAssigneeMode: schema.projects.defaultAssigneeMode,
      defaultAssigneeId: schema.projects.defaultAssigneeId,
      ownerId: schema.projects.ownerId,
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  if (!p) return null;
  return resolveDefaultAssignee(db, p, actorId);
}

export async function filterAccessibleIds(db: Db, userId: string, ids: string[]) {
  if (ids.length === 0) return [] as string[];
  const rows = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        inArray(schema.projects.id, ids),
        or(
          eq(schema.projects.ownerId, userId),
          exists(
            db
              .select({ x: sql`1` })
              .from(schema.projectMembers)
              .where(
                and(
                  eq(schema.projectMembers.projectId, schema.projects.id),
                  eq(schema.projectMembers.userId, userId),
                ),
              ),
          ),
        )!,
      ),
    );
  const accessible = new Set(rows.map((r) => r.id));
  return ids.filter((id) => accessible.has(id));
}

export async function applySortOrder(db: Db, items: Array<{ id: string; sortOrder: number }>) {
  for (const item of items) {
    await db
      .update(schema.projects)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(schema.projects.id, item.id));
  }
}
