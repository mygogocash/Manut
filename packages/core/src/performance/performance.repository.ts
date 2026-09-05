import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";

const employee = alias(schema.users, "appraisal_employee");
const manager = alias(schema.users, "appraisal_manager");
const creator = alias(schema.users, "cycle_creator");

export async function findCycles(db: Db, filters: { status?: string }, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const parts: SQL[] = [];
  if (filters.status) parts.push(eq(schema.appraisalCycles.status, filters.status));
  const where = parts.length ? and(...parts) : undefined;

  const [totalRow] = await db.select({ n: count() }).from(schema.appraisalCycles).where(where);
  const rows = await db
    .select({
      cycle: schema.appraisalCycles,
      creatorId: creator.id,
      creatorName: creator.name,
      creatorEmail: creator.email,
    })
    .from(schema.appraisalCycles)
    .leftJoin(creator, eq(schema.appraisalCycles.createdBy, creator.id))
    .where(where)
    .orderBy(desc(schema.appraisalCycles.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(
    rows.map(async (r) => {
      const [c] = await db
        .select({ n: count() })
        .from(schema.appraisals)
        .where(eq(schema.appraisals.cycleId, r.cycle.id));
      return {
        ...r.cycle,
        creator: r.creatorId
          ? { id: r.creatorId, name: r.creatorName, email: r.creatorEmail }
          : null,
        _count: { appraisals: Number(c?.n ?? 0) },
      };
    }),
  );
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findCycleById(db: Db, id: string) {
  const [row] = await db
    .select({
      cycle: schema.appraisalCycles,
      creatorId: creator.id,
      creatorName: creator.name,
      creatorEmail: creator.email,
    })
    .from(schema.appraisalCycles)
    .leftJoin(creator, eq(schema.appraisalCycles.createdBy, creator.id))
    .where(eq(schema.appraisalCycles.id, id))
    .limit(1);
  if (!row) return null;
  const [c] = await db
    .select({ n: count() })
    .from(schema.appraisals)
    .where(eq(schema.appraisals.cycleId, id));
  return {
    ...row.cycle,
    creator: row.creatorId
      ? { id: row.creatorId, name: row.creatorName, email: row.creatorEmail }
      : null,
    _count: { appraisals: Number(c?.n ?? 0) },
  };
}

export async function createCycle(
  db: Db,
  data: { name: string; description?: string; startDate: string; endDate: string; createdBy: string },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.appraisalCycles).values({
    id,
    name: data.name,
    description: data.description ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    createdBy: data.createdBy,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  return findCycleById(db, id);
}

export async function updateCycle(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    status: string;
  }>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.appraisalCycles)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.appraisalCycles.id, id));
  return findCycleById(db, id);
}

async function loadAppraisal(db: Db, id: string) {
  const [row] = await db
    .select({
      appraisal: schema.appraisals,
      cycleId: schema.appraisalCycles.id,
      cycleName: schema.appraisalCycles.name,
      cycleStatus: schema.appraisalCycles.status,
      empId: employee.id,
      empName: employee.name,
      empEmail: employee.email,
      empDept: employee.department,
      mgrId: manager.id,
      mgrName: manager.name,
      mgrEmail: manager.email,
    })
    .from(schema.appraisals)
    .innerJoin(schema.appraisalCycles, eq(schema.appraisals.cycleId, schema.appraisalCycles.id))
    .innerJoin(employee, eq(schema.appraisals.employeeId, employee.id))
    .leftJoin(manager, eq(schema.appraisals.managerId, manager.id))
    .where(eq(schema.appraisals.id, id))
    .limit(1);
  if (!row) return null;
  const goals = await db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.appraisalId, id))
    .orderBy(schema.goals.createdAt);
  return {
    ...row.appraisal,
    cycle: { id: row.cycleId, name: row.cycleName, status: row.cycleStatus },
    employee: {
      id: row.empId,
      name: row.empName,
      email: row.empEmail,
      department: row.empDept,
    },
    manager: row.mgrId
      ? { id: row.mgrId, name: row.mgrName, email: row.mgrEmail }
      : null,
    goals,
  };
}

export async function findAppraisals(
  db: Db,
  filters: {
    cycleId?: string;
    employeeId?: string;
    managerId?: string;
    status?: string;
    search?: string;
  },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const parts: SQL[] = [];
  if (filters.cycleId) parts.push(eq(schema.appraisals.cycleId, filters.cycleId));
  if (filters.employeeId) parts.push(eq(schema.appraisals.employeeId, filters.employeeId));
  if (filters.managerId) parts.push(eq(schema.appraisals.managerId, filters.managerId));
  if (filters.status) parts.push(eq(schema.appraisals.status, filters.status));
  if (filters.search) {
    const q = `%${filters.search}%`;
    parts.push(or(ilike(employee.name, q), ilike(employee.email, q))!);
  }
  const where = parts.length ? and(...parts) : undefined;

  const base = db
    .select({ id: schema.appraisals.id })
    .from(schema.appraisals)
    .innerJoin(employee, eq(schema.appraisals.employeeId, employee.id))
    .where(where);

  const idRows = await base.orderBy(desc(schema.appraisals.createdAt)).limit(limit).offset(offset);
  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.appraisals)
    .innerJoin(employee, eq(schema.appraisals.employeeId, employee.id))
    .where(where);

  const data = [];
  for (const r of idRows) {
    const full = await loadAppraisal(db, r.id);
    if (full) data.push(full);
  }
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findAppraisalById(db: Db, id: string) {
  return loadAppraisal(db, id);
}

export async function createAppraisal(
  db: Db,
  data: { cycleId: string; employeeId: string; managerId?: string },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.appraisals).values({
    id,
    cycleId: data.cycleId,
    employeeId: data.employeeId,
    managerId: data.managerId ?? null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return loadAppraisal(db, id);
}

export async function updateAppraisal(
  db: Db,
  id: string,
  data: Partial<{
    selfRating: number;
    selfComment: string | null;
    managerRating: number;
    managerComment: string | null;
    finalRating: number;
    status: string;
    completedAt: string | null;
  }>,
) {
  const now = new Date().toISOString();
  await db.update(schema.appraisals).set({ ...data, updatedAt: now }).where(eq(schema.appraisals.id, id));
  return loadAppraisal(db, id);
}

export async function findGoalsByAppraisal(db: Db, appraisalId: string) {
  return db.select().from(schema.goals).where(eq(schema.goals.appraisalId, appraisalId)).orderBy(schema.goals.createdAt);
}

export async function findGoalById(db: Db, id: string) {
  const [goal] = await db.select().from(schema.goals).where(eq(schema.goals.id, id)).limit(1);
  if (!goal) return null;
  const [appraisal] = await db
    .select({
      id: schema.appraisals.id,
      employeeId: schema.appraisals.employeeId,
      managerId: schema.appraisals.managerId,
    })
    .from(schema.appraisals)
    .where(eq(schema.appraisals.id, goal.appraisalId))
    .limit(1);
  return appraisal ? { ...goal, appraisal } : null;
}

export async function createGoal(
  db: Db,
  data: { appraisalId: string; title: string; description?: string; weight?: number },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.goals).values({
    id,
    appraisalId: data.appraisalId,
    title: data.title,
    description: data.description ?? null,
    weight: data.weight ?? 0,
    status: "not_started",
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db.select().from(schema.goals).where(eq(schema.goals.id, id)).limit(1);
  return row ?? null;
}

export async function updateGoal(
  db: Db,
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    weight: number;
    selfScore: number;
    managerScore: number;
    status: string;
  }>,
) {
  const now = new Date().toISOString();
  await db.update(schema.goals).set({ ...data, updatedAt: now }).where(eq(schema.goals.id, id));
  const [row] = await db.select().from(schema.goals).where(eq(schema.goals.id, id)).limit(1);
  return row ?? null;
}

export async function deleteGoal(db: Db, id: string) {
  await db.delete(schema.goals).where(eq(schema.goals.id, id));
}
