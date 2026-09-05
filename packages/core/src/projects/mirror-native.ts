import { and, eq, or } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const DEFAULT_COLUMNS = [
  { key: "backlog", label: "Backlog", color: "bg-zinc-500", sortOrder: 0 },
  { key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 1 },
  { key: "in_progress", label: "In Progress", color: "bg-amber-500", sortOrder: 2 },
  { key: "in_review", label: "In Review", color: "bg-purple-500", sortOrder: 3 },
  { key: "done", label: "Done", color: "bg-emerald-500", sortOrder: 4 },
] as const;

type NativeTeam = "legal" | "accounting" | "it" | "product";

type NativeProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerId: string;
  startDate: string | null;
  endDate: string | null;
  productionLiveDate: string | null;
  goLiveDate: string | null;
  revisedGoLiveDate: string | null;
  dependency: string | null;
  comment: string | null;
  sortOrder: number;
  department: string | null;
  workstream?: string | null;
  details?: string | null;
  createdAt: string;
  members: Array<{ userId: string; role: string }>;
  columns: Array<{ key: string; label: string; color: string; sortOrder: number }>;
  tasks: Array<{
    id: string;
    parentTaskId: string | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    ownerId: string | null;
    startDate: string | null;
    endDate: string | null;
    sortOrder: number;
    assignees: Array<{ userId: string; allocationPct: number | null }>;
  }>;
};

function idOrSlugWhere(idOrSlug: string) {
  return or(eq(schema.projects.id, idOrSlug), eq(schema.projects.slug, idOrSlug));
}

async function loadNativeProject(db: Db, idOrSlug: string): Promise<{ team: NativeTeam; src: NativeProjectRow } | null> {
  const memberSelect = async (
    table:
      | typeof schema.legalProjectMembers
      | typeof schema.accountingProjectMembers
      | typeof schema.itProjectMembers
      | typeof schema.productProjectMembers,
    projectId: string,
  ) =>
    db
      .select({ userId: table.userId, role: table.role })
      .from(table)
      .where(eq(table.projectId, projectId));

  const columnSelect = async (
    table:
      | typeof schema.legalProjectColumns
      | typeof schema.accountingProjectColumns
      | typeof schema.itProjectColumns
      | typeof schema.productProjectColumns,
    projectId: string,
  ) =>
    db
      .select({ key: table.key, label: table.label, color: table.color, sortOrder: table.sortOrder })
      .from(table)
      .where(eq(table.projectId, projectId));

  const taskSelect = async (
    taskTable:
      | typeof schema.legalProjectTasks
      | typeof schema.accountingProjectTasks
      | typeof schema.itProjectTasks
      | typeof schema.productProjectTasks,
    assigneeTable:
      | typeof schema.legalProjectTaskAssignees
      | typeof schema.accountingProjectTaskAssignees
      | typeof schema.itProjectTaskAssignees
      | typeof schema.productProjectTaskAssignees,
    projectId: string,
  ) => {
    const tasks = await db
      .select({
        id: taskTable.id,
        parentTaskId: taskTable.parentTaskId,
        title: taskTable.title,
        description: taskTable.description,
        status: taskTable.status,
        priority: taskTable.priority,
        ownerId: taskTable.ownerId,
        startDate: taskTable.startDate,
        endDate: taskTable.endDate,
        sortOrder: taskTable.sortOrder,
      })
      .from(taskTable)
      .where(eq(taskTable.projectId, projectId));

    return Promise.all(
      tasks.map(async (t) => {
        const assignees = await db
          .select({ userId: assigneeTable.userId, allocationPct: assigneeTable.allocationPct })
          .from(assigneeTable)
          .where(eq(assigneeTable.taskId, t.id));
        return { ...t, assignees };
      }),
    );
  };

  const findLegal = async () => {
    const [row] = await db
      .select()
      .from(schema.legalProjects)
      .where(or(eq(schema.legalProjects.id, idOrSlug), eq(schema.legalProjects.slug, idOrSlug)))
      .limit(1);
    if (!row) return null;
    const [members, columns, tasks] = await Promise.all([
      memberSelect(schema.legalProjectMembers, row.id),
      columnSelect(schema.legalProjectColumns, row.id),
      taskSelect(schema.legalProjectTasks, schema.legalProjectTaskAssignees, row.id),
    ]);
    return {
      team: "legal" as const,
      src: { ...row, workstream: row.workstream, details: row.details, members, columns, tasks },
    };
  };

  const findAccounting = async () => {
    const [row] = await db
      .select()
      .from(schema.accountingProjects)
      .where(or(eq(schema.accountingProjects.id, idOrSlug), eq(schema.accountingProjects.slug, idOrSlug)))
      .limit(1);
    if (!row) return null;
    const [members, columns, tasks] = await Promise.all([
      memberSelect(schema.accountingProjectMembers, row.id),
      columnSelect(schema.accountingProjectColumns, row.id),
      taskSelect(schema.accountingProjectTasks, schema.accountingProjectTaskAssignees, row.id),
    ]);
    return {
      team: "accounting" as const,
      src: { ...row, workstream: row.workstream, details: row.details, members, columns, tasks },
    };
  };

  const findIt = async () => {
    const [row] = await db
      .select()
      .from(schema.itProjects)
      .where(or(eq(schema.itProjects.id, idOrSlug), eq(schema.itProjects.slug, idOrSlug)))
      .limit(1);
    if (!row) return null;
    const [members, columns, tasks] = await Promise.all([
      memberSelect(schema.itProjectMembers, row.id),
      columnSelect(schema.itProjectColumns, row.id),
      taskSelect(schema.itProjectTasks, schema.itProjectTaskAssignees, row.id),
    ]);
    return { team: "it" as const, src: { ...row, members, columns, tasks } };
  };

  const findProduct = async () => {
    const [row] = await db
      .select()
      .from(schema.productProjects)
      .where(or(eq(schema.productProjects.id, idOrSlug), eq(schema.productProjects.slug, idOrSlug)))
      .limit(1);
    if (!row) return null;
    const [members, columns, tasks] = await Promise.all([
      memberSelect(schema.productProjectMembers, row.id),
      columnSelect(schema.productProjectColumns, row.id),
      taskSelect(schema.productProjectTasks, schema.productProjectTaskAssignees, row.id),
    ]);
    return { team: "product" as const, src: { ...row, members, columns, tasks } };
  };

  const legal = await findLegal();
  if (legal) return legal;
  const accounting = await findAccounting();
  if (accounting) return accounting;
  const itp = await findIt();
  if (itp) return itp;
  return findProduct();
}

async function resolveUniqueSlug(db: Db, baseSlug: string, team: NativeTeam): Promise<string> {
  let slug = baseSlug;
  for (let i = 1; ; i++) {
    const [clash] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.slug, slug))
      .limit(1);
    if (!clash) return slug;
    slug = `${baseSlug}-${team}${i > 1 ? `-${i}` : ""}`;
  }
}

/** Lazily mirror native legal/it/accounting/product rows into `projects`. Idempotent. */
export async function mirrorNativeProjectIfNeeded(db: Db, idOrSlug: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(idOrSlugWhere(idOrSlug))
    .limit(1);
  if (existing) return true;

  const native = await loadNativeProject(db, idOrSlug);
  if (!native) return false;

  const { team, src } = native;
  const slug = await resolveUniqueSlug(db, src.slug, team);
  const columns = src.columns.length > 0 ? src.columns : [...DEFAULT_COLUMNS];
  const now = new Date().toISOString();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.projects).values({
        id: src.id,
        name: src.name,
        slug,
        description: src.description,
        status: src.status,
        ownerId: src.ownerId,
        team,
        startDate: src.startDate,
        endDate: src.endDate,
        productionLiveDate: src.productionLiveDate,
        goLiveDate: src.goLiveDate,
        revisedGoLiveDate: src.revisedGoLiveDate,
        dependency: src.dependency,
        comment: src.comment,
        department: src.department,
        workstream: src.workstream ?? null,
        details: src.details ?? null,
        sortOrder: src.sortOrder,
        createdAt: src.createdAt,
        updatedAt: now,
      });

      if (src.members.length > 0) {
        await tx.insert(schema.projectMembers).values(
          src.members.map((m) => ({
            id: crypto.randomUUID(),
            projectId: src.id,
            userId: m.userId,
            role: m.role,
          })),
        );
      }

      await tx.insert(schema.projectColumns).values(
        columns.map((c) => ({
          id: crypto.randomUUID(),
          projectId: src.id,
          key: c.key,
          label: c.label,
          color: c.color,
          sortOrder: c.sortOrder,
        })),
      );

      if (src.tasks.length > 0) {
        const ordered = [...src.tasks].sort(
          (a, b) => Number(Boolean(a.parentTaskId)) - Number(Boolean(b.parentTaskId)),
        );
        await tx.insert(schema.projectTasks).values(
          ordered.map((t) => ({
            id: t.id,
            projectId: src.id,
            parentTaskId: t.parentTaskId,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            ownerId: t.ownerId,
            startDate: t.startDate,
            endDate: t.endDate,
            sortOrder: t.sortOrder,
            updatedAt: now,
          })),
        );

        const assignees = ordered.flatMap((t) =>
          t.assignees.map((a) => ({
            id: crypto.randomUUID(),
            taskId: t.id,
            userId: a.userId,
            allocationPct: a.allocationPct,
          })),
        );
        if (assignees.length > 0) {
          await tx.insert(schema.projectTaskAssignees).values(assignees);
        }
      }
    });
  } catch {
    const [nowExists] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.id, src.id))
      .limit(1);
    if (nowExists) return true;
    throw new Error("MIRROR_NATIVE_PROJECT_FAILED");
  }

  return true;
}
