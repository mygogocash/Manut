import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { schema } from "@nexora/db";

import type { Db } from "@nexora/db";

type GrantInsert = Omit<typeof schema.esopGrants.$inferInsert, "id" | "createdAt" | "updatedAt">;
type OnboardingInsert = Omit<typeof schema.onboardingRuns.$inferInsert, "id" | "createdAt" | "updatedAt">;
type OffboardingInsert = Omit<typeof schema.offboardingRuns.$inferInsert, "id" | "createdAt" | "updatedAt">;
type AgreementInsert = Omit<typeof schema.employeeAgreements.$inferInsert, "id" | "createdAt" | "updatedAt">;
type EquitySalaryInsert = Omit<typeof schema.equityMonthlySalary.$inferInsert, "id" | "createdAt" | "updatedAt">;
import {
  effectiveVestedToDate,
  isScheduled,
  rollupGrants,
  type VestingGrant,
} from "./esop-vesting.js";

function toVestingGrant(g: {
  shares: number;
  grantDate: string;
  vestingMonths: number | null;
  cliffMonths: number | null;
  allocationStartMonth?: string | null;
  vestedToDateOverride?: number | null;
}): VestingGrant {
  return {
    shares: g.shares,
    grantDate: new Date(g.grantDate),
    vestingMonths: g.vestingMonths,
    cliffMonths: g.cliffMonths,
    allocationStartMonth: g.allocationStartMonth ? new Date(g.allocationStartMonth) : null,
    vestedToDateOverride: g.vestedToDateOverride,
  };
}

const ESOP_SUMMARY_STATUSES = ["active", "vesting", "vested", "exercised"];

const poolGrantSelect = {
  shares: schema.esopGrants.shares,
  grantDate: schema.esopGrants.grantDate,
  vestingMonths: schema.esopGrants.vestingMonths,
  cliffMonths: schema.esopGrants.cliffMonths,
  allocationStartMonth: schema.esopGrants.allocationStartMonth,
  vestedToDateOverride: schema.esopGrants.vestedToDateOverride,
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapGrantRow(
  row: typeof schema.esopGrants.$inferSelect,
  employee?: { id: string; name: string; email: string; department: string | null } | null,
) {
  return {
    ...row,
    currencyAmount: num(row.currencyAmount),
    employee: employee ?? null,
  };
}

export async function getEsopPoolSummary(db: Db) {
  const grants = await db
    .select(poolGrantSelect)
    .from(schema.esopGrants)
    .where(inArray(schema.esopGrants.status, ESOP_SUMMARY_STATUSES));
  return rollupGrants(grants.map(toVestingGrant), new Date());
}

export async function getEsopEmployeeSummary(db: Db, employeeId: string) {
  const [employee] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      department: schema.users.department,
    })
    .from(schema.users)
    .where(eq(schema.users.id, employeeId))
    .limit(1);
  if (!employee) return null;

  const grants = await db
    .select()
    .from(schema.esopGrants)
    .where(
      and(
        eq(schema.esopGrants.employeeId, employeeId),
        inArray(schema.esopGrants.status, ESOP_SUMMARY_STATUSES),
      ),
    )
    .orderBy(asc(schema.esopGrants.grantDate));

  const now = new Date();
  const kpis = rollupGrants(grants.map(toVestingGrant), now);
  const instruments = grants.map((g) => ({
    id: g.id,
    grantType: g.grantType,
    scheduled: isScheduled(g),
    shares: g.shares,
    vestedToDate: effectiveVestedToDate(toVestingGrant(g), now),
    vestedToDateOverride: g.vestedToDateOverride,
    vestingMonths: g.vestingMonths,
    cliffMonths: g.cliffMonths,
    lockMonths: g.lockMonths,
    grantDate: g.grantDate,
    allocationStartMonth: g.allocationStartMonth,
    allocationEndMonth: g.allocationEndMonth,
    currencyCode: g.currencyCode,
    currencyAmount: num(g.currencyAmount),
    source: g.source,
    status: g.status,
  }));

  return { employee, kpis, instruments };
}

export async function findGrants(
  db: Db,
  filters: {
    status?: string;
    employeeId?: string;
    sortBy?:
      | "employee"
      | "grantType"
      | "usd"
      | "thb"
      | "shares"
      | "lockMonths"
      | "vestingMonths"
      | "cliffMonths"
      | "status";
    sortOrder?: "asc" | "desc";
  },
  page: number,
  limit: number,
) {
  const conditions = [];
  if (filters.status) conditions.push(eq(schema.esopGrants.status, filters.status));
  if (filters.employeeId) conditions.push(eq(schema.esopGrants.employeeId, filters.employeeId));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const dir = filters.sortOrder === "desc" ? desc : asc;
  const emp = alias(schema.users, "esop_employee");

  let orderBy;
  switch (filters.sortBy) {
    case "employee":
      orderBy = [dir(emp.name), desc(schema.esopGrants.grantDate)];
      break;
    case "grantType":
      orderBy = [dir(schema.esopGrants.grantType), asc(emp.name)];
      break;
    case "shares":
      orderBy = [dir(schema.esopGrants.shares), asc(emp.name)];
      break;
    case "lockMonths":
      orderBy = [dir(schema.esopGrants.lockMonths), asc(emp.name)];
      break;
    case "vestingMonths":
      orderBy = [dir(schema.esopGrants.vestingMonths), asc(emp.name)];
      break;
    case "cliffMonths":
      orderBy = [dir(schema.esopGrants.cliffMonths), asc(emp.name)];
      break;
    case "status":
      orderBy = [dir(schema.esopGrants.status), asc(emp.name)];
      break;
    case "usd":
    case "thb":
      orderBy = [dir(schema.esopGrants.currencyAmount), asc(emp.name)];
      break;
    default:
      orderBy = [asc(emp.name), desc(schema.esopGrants.grantDate)];
  }

  const rows = await db
    .select({ grant: schema.esopGrants, employee: emp })
    .from(schema.esopGrants)
    .leftJoin(emp, eq(schema.esopGrants.employeeId, emp.id))
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db
    .select({ total: count() })
    .from(schema.esopGrants)
    .where(whereClause);

  return {
    data: rows.map((r) =>
      mapGrantRow(r.grant, r.employee
        ? { id: r.employee.id, name: r.employee.name, email: r.employee.email, department: r.employee.department }
        : null),
    ),
    total: totalRow?.total ?? 0,
  };
}

export async function findGrantById(db: Db, id: string) {
  const emp = alias(schema.users, "esop_employee");
  const [row] = await db
    .select({ grant: schema.esopGrants, employee: emp })
    .from(schema.esopGrants)
    .leftJoin(emp, eq(schema.esopGrants.employeeId, emp.id))
    .where(eq(schema.esopGrants.id, id))
    .limit(1);
  if (!row) return null;
  return mapGrantRow(
    row.grant,
    row.employee
      ? { id: row.employee.id, name: row.employee.name, email: row.employee.email, department: row.employee.department }
      : null,
  );
}

export async function createGrant(
  db: Db,
  data: GrantInsert,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.esopGrants).values({ ...data, id, createdAt: now, updatedAt: now });
  return findGrantById(db, id);
}

export async function updateGrant(
  db: Db,
  id: string,
  data: Partial<typeof schema.esopGrants.$inferInsert>,
) {
  await db
    .update(schema.esopGrants)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.esopGrants.id, id));
  return findGrantById(db, id);
}

export async function deleteGrant(db: Db, id: string) {
  await db.delete(schema.esopGrants).where(eq(schema.esopGrants.id, id));
}

export async function bulkDeleteGrants(db: Db, ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  const result = await db.delete(schema.esopGrants).where(inArray(schema.esopGrants.id, ids));
  return { count: ids.length };
}

export async function deleteAllGrants(db: Db) {
  const result = await db.delete(schema.esopGrants);
  return { count: 0 };
}

// ── Onboarding ──

async function findOnboardingWithRelations(db: Db, whereClause: ReturnType<typeof and> | ReturnType<typeof eq>) {
  const emp = alias(schema.users, "onboard_employee");
  const ent = alias(schema.entities, "onboard_entity");
  const rows = await db
    .select({ run: schema.onboardingRuns, employee: emp, entity: ent })
    .from(schema.onboardingRuns)
    .leftJoin(emp, eq(schema.onboardingRuns.employeeId, emp.id))
    .leftJoin(ent, eq(schema.onboardingRuns.entityId, ent.id))
    .where(whereClause);
  return rows.map((r) => ({
    ...r.run,
    employee: r.employee ? { id: r.employee.id, name: r.employee.name, email: r.employee.email } : null,
    entity: r.entity ? { id: r.entity.id, name: r.entity.name } : null,
  }));
}

export async function findOnboardingRuns(
  db: Db,
  filters: { status?: string; employeeId?: string; deleted?: boolean },
  page: number,
  limit: number,
) {
  const conditions = [];
  if (filters.status) conditions.push(eq(schema.onboardingRuns.status, filters.status));
  if (filters.employeeId) conditions.push(eq(schema.onboardingRuns.employeeId, filters.employeeId));
  conditions.push(filters.deleted ? isNotNull(schema.onboardingRuns.deletedAt) : isNull(schema.onboardingRuns.deletedAt));
  const whereClause = and(...conditions);

  const emp = alias(schema.users, "onboard_employee");
  const ent = alias(schema.entities, "onboard_entity");

  const rows = await db
    .select({ run: schema.onboardingRuns, employee: emp, entity: ent })
    .from(schema.onboardingRuns)
    .leftJoin(emp, eq(schema.onboardingRuns.employeeId, emp.id))
    .leftJoin(ent, eq(schema.onboardingRuns.entityId, ent.id))
    .where(whereClause)
    .orderBy(desc(schema.onboardingRuns.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db.select({ total: count() }).from(schema.onboardingRuns).where(whereClause);

  return {
    data: rows.map((r) => ({
      ...r.run,
      employee: r.employee ? { id: r.employee.id, name: r.employee.name, email: r.employee.email } : null,
      entity: r.entity ? { id: r.entity.id, name: r.entity.name } : null,
    })),
    total: totalRow?.total ?? 0,
  };
}

export async function findOnboardingById(db: Db, id: string) {
  const rows = await findOnboardingWithRelations(
    db,
    and(eq(schema.onboardingRuns.id, id), isNull(schema.onboardingRuns.deletedAt)),
  );
  return rows[0] ?? null;
}

export async function findOnboardingByIdIncludingDeleted(db: Db, id: string) {
  const rows = await findOnboardingWithRelations(db, eq(schema.onboardingRuns.id, id));
  return rows[0] ?? null;
}

export async function softDeleteOnboarding(db: Db, id: string) {
  const now = new Date().toISOString();
  await db.update(schema.onboardingRuns).set({ deletedAt: now, updatedAt: now }).where(eq(schema.onboardingRuns.id, id));
  return findOnboardingByIdIncludingDeleted(db, id);
}

export async function restoreOnboarding(db: Db, id: string) {
  const now = new Date().toISOString();
  await db.update(schema.onboardingRuns).set({ deletedAt: null, updatedAt: now }).where(eq(schema.onboardingRuns.id, id));
  return findOnboardingById(db, id);
}

export async function createOnboarding(db: Db, data: OnboardingInsert) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.onboardingRuns).values({ ...data, id, createdAt: now, updatedAt: now });
  return findOnboardingById(db, id);
}

export async function updateOnboarding(
  db: Db,
  id: string,
  data: Partial<typeof schema.onboardingRuns.$inferInsert>,
) {
  await db
    .update(schema.onboardingRuns)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.onboardingRuns.id, id));
  return findOnboardingById(db, id);
}

// ── Offboarding ──

async function findOffboardingWithRelations(db: Db, whereClause: ReturnType<typeof and> | ReturnType<typeof eq>) {
  const emp = alias(schema.users, "offboard_employee");
  const ent = alias(schema.entities, "offboard_entity");
  const rows = await db
    .select({ run: schema.offboardingRuns, employee: emp, entity: ent })
    .from(schema.offboardingRuns)
    .leftJoin(emp, eq(schema.offboardingRuns.employeeId, emp.id))
    .leftJoin(ent, eq(schema.offboardingRuns.entityId, ent.id))
    .where(whereClause);
  return rows.map((r) => ({
    ...r.run,
    employee: r.employee ? { id: r.employee.id, name: r.employee.name, email: r.employee.email } : null,
    entity: r.entity ? { id: r.entity.id, name: r.entity.name } : null,
  }));
}

export async function findOffboardingRuns(
  db: Db,
  filters: { status?: string; employeeId?: string; deleted?: boolean },
  page: number,
  limit: number,
) {
  const conditions = [];
  if (filters.status) conditions.push(eq(schema.offboardingRuns.status, filters.status));
  if (filters.employeeId) conditions.push(eq(schema.offboardingRuns.employeeId, filters.employeeId));
  conditions.push(filters.deleted ? isNotNull(schema.offboardingRuns.deletedAt) : isNull(schema.offboardingRuns.deletedAt));
  const whereClause = and(...conditions);

  const emp = alias(schema.users, "offboard_employee");
  const ent = alias(schema.entities, "offboard_entity");

  const rows = await db
    .select({ run: schema.offboardingRuns, employee: emp, entity: ent })
    .from(schema.offboardingRuns)
    .leftJoin(emp, eq(schema.offboardingRuns.employeeId, emp.id))
    .leftJoin(ent, eq(schema.offboardingRuns.entityId, ent.id))
    .where(whereClause)
    .orderBy(desc(schema.offboardingRuns.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db.select({ total: count() }).from(schema.offboardingRuns).where(whereClause);

  return {
    data: rows.map((r) => ({
      ...r.run,
      employee: r.employee ? { id: r.employee.id, name: r.employee.name, email: r.employee.email } : null,
      entity: r.entity ? { id: r.entity.id, name: r.entity.name } : null,
    })),
    total: totalRow?.total ?? 0,
  };
}

export async function findOffboardingById(db: Db, id: string) {
  const rows = await findOffboardingWithRelations(
    db,
    and(eq(schema.offboardingRuns.id, id), isNull(schema.offboardingRuns.deletedAt)),
  );
  return rows[0] ?? null;
}

export async function findOffboardingByIdIncludingDeleted(db: Db, id: string) {
  const rows = await findOffboardingWithRelations(db, eq(schema.offboardingRuns.id, id));
  return rows[0] ?? null;
}

export async function softDeleteOffboarding(db: Db, id: string) {
  const now = new Date().toISOString();
  await db.update(schema.offboardingRuns).set({ deletedAt: now, updatedAt: now }).where(eq(schema.offboardingRuns.id, id));
  return findOffboardingByIdIncludingDeleted(db, id);
}

export async function restoreOffboarding(db: Db, id: string) {
  const now = new Date().toISOString();
  await db.update(schema.offboardingRuns).set({ deletedAt: null, updatedAt: now }).where(eq(schema.offboardingRuns.id, id));
  return findOffboardingById(db, id);
}

export async function createOffboarding(db: Db, data: OffboardingInsert) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.offboardingRuns).values({ ...data, id, createdAt: now, updatedAt: now });
  return findOffboardingById(db, id);
}

export async function updateOffboarding(
  db: Db,
  id: string,
  data: Partial<typeof schema.offboardingRuns.$inferInsert>,
) {
  await db
    .update(schema.offboardingRuns)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.offboardingRuns.id, id));
  return findOffboardingById(db, id);
}

// ── Agreements ──

async function mapAgreementRow(
  db: Db,
  agreement: typeof schema.employeeAgreements.$inferSelect,
) {
  const [employee] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, agreement.employeeId))
    .limit(1);
  const [uploadedBy] = agreement.uploadedById
    ? await db
        .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, agreement.uploadedById))
        .limit(1)
    : [null];
  return { ...agreement, employee: employee ?? null, uploadedBy: uploadedBy ?? null };
}

export async function findAgreements(
  db: Db,
  filters: { employeeId?: string; type?: string },
  page: number,
  limit: number,
) {
  const conditions = [];
  if (filters.employeeId) conditions.push(eq(schema.employeeAgreements.employeeId, filters.employeeId));
  if (filters.type) conditions.push(eq(schema.employeeAgreements.type, filters.type));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.employeeAgreements)
    .where(whereClause)
    .orderBy(asc(schema.employeeAgreements.employeeId), desc(schema.employeeAgreements.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db
    .select({ total: count() })
    .from(schema.employeeAgreements)
    .where(whereClause);

  const data = await Promise.all(rows.map((r) => mapAgreementRow(db, r)));
  return { data, total: totalRow?.total ?? 0 };
}

export async function findAgreementById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.employeeAgreements)
    .where(eq(schema.employeeAgreements.id, id))
    .limit(1);
  if (!row) return null;
  return mapAgreementRow(db, row);
}

export async function createAgreement(db: Db, data: AgreementInsert) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.employeeAgreements).values({ ...data, id, createdAt: now, updatedAt: now });
  return findAgreementById(db, id);
}

export async function updateAgreement(
  db: Db,
  id: string,
  data: Partial<typeof schema.employeeAgreements.$inferInsert>,
) {
  await db
    .update(schema.employeeAgreements)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.employeeAgreements.id, id));
  return findAgreementById(db, id);
}

export async function deleteAgreement(db: Db, id: string) {
  await db.delete(schema.employeeAgreements).where(eq(schema.employeeAgreements.id, id));
}

export async function findAgreementFolders(db: Db) {
  const employees = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      department: schema.users.department,
      jobTitle: schema.users.jobTitle,
      employeeId: schema.users.employeeId,
    })
    .from(schema.users)
    .where(eq(schema.users.isActive, true))
    .orderBy(asc(schema.users.name));

  const activeIds = employees.map((u) => u.id);
  if (activeIds.length === 0) {
    return employees.map((u) => ({
      employee: u,
      total: 0,
      byType: {} as Record<string, number>,
      lastUpdatedAt: null as string | null,
    }));
  }

  const agreements = await db
    .select({
      employeeId: schema.employeeAgreements.employeeId,
      type: schema.employeeAgreements.type,
      updatedAt: schema.employeeAgreements.updatedAt,
    })
    .from(schema.employeeAgreements)
    .where(inArray(schema.employeeAgreements.employeeId, activeIds));

  const byEmployee = new Map<
    string,
    { byType: Record<string, number>; total: number; lastUpdatedAt: string | null }
  >();

  for (const a of agreements) {
    const entry = byEmployee.get(a.employeeId) ?? {
      byType: {} as Record<string, number>,
      total: 0,
      lastUpdatedAt: null as string | null,
    };
    entry.byType[a.type] = (entry.byType[a.type] ?? 0) + 1;
    entry.total += 1;
    if (!entry.lastUpdatedAt || a.updatedAt > entry.lastUpdatedAt) {
      entry.lastUpdatedAt = a.updatedAt;
    }
    byEmployee.set(a.employeeId, entry);
  }

  return employees.map((u) => {
    const stats = byEmployee.get(u.id) ?? {
      byType: {} as Record<string, number>,
      total: 0,
      lastUpdatedAt: null as string | null,
    };
    return {
      employee: u,
      total: stats.total,
      byType: stats.byType,
      lastUpdatedAt: stats.lastUpdatedAt,
    };
  });
}

// ── Equity Monthly Salary ──

export async function listEquitySalaries(db: Db, filters: { year?: number }) {
  const conditions = [];
  if (filters.year !== undefined) conditions.push(eq(schema.equityMonthlySalary.year, filters.year));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.equityMonthlySalary)
    .where(whereClause)
    .orderBy(desc(schema.equityMonthlySalary.year), asc(schema.equityMonthlySalary.employeeName));

  return rows.map((r) => ({
    ...r,
    monthlyShares: (r.monthlyShares ?? {}) as Record<string, number>,
  }));
}

export async function replaceEquitySalariesForYear(
  db: Db,
  year: number,
  rows: EquitySalaryInsert[],
) {
  await db.delete(schema.equityMonthlySalary).where(eq(schema.equityMonthlySalary.year, year));
  if (rows.length > 0) {
    const now = new Date().toISOString();
    await db.insert(schema.equityMonthlySalary).values(
      rows.map((r) => ({ ...r, id: crypto.randomUUID(), createdAt: now, updatedAt: now })),
    );
  }
  return rows.length;
}

export async function deleteAllEquitySalaries(db: Db) {
  const result = await db.delete(schema.equityMonthlySalary);
  return 0;
}
