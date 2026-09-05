import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export async function findAll(
  db: Db,
  filters: { category?: string; entityId?: string },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const parts = [];
  if (filters.category) parts.push(eq(schema.benefits.category, filters.category));
  if (filters.entityId) parts.push(eq(schema.benefits.entityId, filters.entityId));
  const where = parts.length ? and(...parts) : undefined;

  const [totalRow] = await db.select({ n: count() }).from(schema.benefits).where(where);
  const rows = await db
    .select()
    .from(schema.benefits)
    .where(where)
    .orderBy(desc(schema.benefits.createdAt), asc(schema.benefits.name))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(
    rows.map(async (row) => {
      const [entity, enrollCount] = await Promise.all([
        row.entityId
          ? db
              .select({ id: schema.entities.id, name: schema.entities.name })
              .from(schema.entities)
              .where(eq(schema.entities.id, row.entityId))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
        db
          .select({ n: count() })
          .from(schema.benefitEnrollments)
          .where(eq(schema.benefitEnrollments.benefitId, row.id))
          .then((r) => Number(r[0]?.n ?? 0)),
      ]);
      return { ...row, entity, _count: { enrollments: enrollCount } };
    }),
  );
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.benefits).where(eq(schema.benefits.id, id)).limit(1);
  if (!row) return null;
  const [entity, enrollments] = await Promise.all([
    row.entityId
      ? db
          .select({ id: schema.entities.id, name: schema.entities.name })
          .from(schema.entities)
          .where(eq(schema.entities.id, row.entityId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select({
        id: schema.benefitEnrollments.id,
        benefitId: schema.benefitEnrollments.benefitId,
        employeeId: schema.benefitEnrollments.employeeId,
        startDate: schema.benefitEnrollments.startDate,
        endDate: schema.benefitEnrollments.endDate,
        status: schema.benefitEnrollments.status,
        employeeName: schema.users.name,
        employeeEmail: schema.users.email,
      })
      .from(schema.benefitEnrollments)
      .innerJoin(schema.users, eq(schema.users.id, schema.benefitEnrollments.employeeId))
      .where(eq(schema.benefitEnrollments.benefitId, id))
      .orderBy(desc(schema.benefitEnrollments.startDate)),
  ]);
  return {
    ...row,
    entity,
    enrollments: enrollments.map((e) => ({
      id: e.id,
      benefitId: e.benefitId,
      employeeId: e.employeeId,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
      employee: { id: e.employeeId, name: e.employeeName, email: e.employeeEmail },
    })),
  };
}

export async function create(
  db: Db,
  input: {
    name: string;
    category: string;
    description?: string | null;
    provider?: string | null;
    cost: number | string;
    currency: string;
    entityId?: string | null;
    isActive: boolean;
  },
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.benefits).values({
    id,
    name: input.name,
    category: input.category,
    description: input.description ?? null,
    provider: input.provider ?? null,
    cost: String(input.cost),
    currency: input.currency,
    entityId: input.entityId ?? null,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  input: Partial<{
    name: string;
    category: string;
    description: string | null;
    provider: string | null;
    cost: number | string;
    currency: string;
    entityId: string | null;
    isActive: boolean;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.provider !== undefined) patch.provider = input.provider;
  if (input.cost !== undefined) patch.cost = String(input.cost);
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.entityId !== undefined) patch.entityId = input.entityId;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  await db.update(schema.benefits).set(patch).where(eq(schema.benefits.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.benefits).where(eq(schema.benefits.id, id));
}

export async function findEnrollment(db: Db, benefitId: string, employeeId: string) {
  const [row] = await db
    .select()
    .from(schema.benefitEnrollments)
    .where(
      and(
        eq(schema.benefitEnrollments.benefitId, benefitId),
        eq(schema.benefitEnrollments.employeeId, employeeId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function enroll(
  db: Db,
  data: { benefitId: string; employeeId: string; startDate: string },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.benefitEnrollments).values({
    id,
    benefitId: data.benefitId,
    employeeId: data.employeeId,
    startDate: data.startDate,
    status: "active",
  });
  return findEnrollmentById(db, id);
}

export async function unenroll(db: Db, enrollmentId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(schema.benefitEnrollments)
    .set({ status: "inactive", endDate: today })
    .where(eq(schema.benefitEnrollments.id, enrollmentId));
  return findEnrollmentById(db, enrollmentId);
}

export async function findEnrollmentById(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.benefitEnrollments.id,
      benefitId: schema.benefitEnrollments.benefitId,
      employeeId: schema.benefitEnrollments.employeeId,
      startDate: schema.benefitEnrollments.startDate,
      endDate: schema.benefitEnrollments.endDate,
      status: schema.benefitEnrollments.status,
      employeeName: schema.users.name,
      employeeEmail: schema.users.email,
    })
    .from(schema.benefitEnrollments)
    .innerJoin(schema.users, eq(schema.users.id, schema.benefitEnrollments.employeeId))
    .where(eq(schema.benefitEnrollments.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    benefitId: row.benefitId,
    employeeId: row.employeeId,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    employee: { id: row.employeeId, name: row.employeeName, email: row.employeeEmail },
  };
}

export async function getEnrollmentsByEmployee(db: Db, employeeId: string) {
  const rows = await db
    .select({
      id: schema.benefitEnrollments.id,
      benefitId: schema.benefitEnrollments.benefitId,
      employeeId: schema.benefitEnrollments.employeeId,
      startDate: schema.benefitEnrollments.startDate,
      endDate: schema.benefitEnrollments.endDate,
      status: schema.benefitEnrollments.status,
      benefitName: schema.benefits.name,
      benefitCategory: schema.benefits.category,
      benefitProvider: schema.benefits.provider,
      benefitCost: schema.benefits.cost,
      benefitCurrency: schema.benefits.currency,
    })
    .from(schema.benefitEnrollments)
    .innerJoin(schema.benefits, eq(schema.benefits.id, schema.benefitEnrollments.benefitId))
    .where(eq(schema.benefitEnrollments.employeeId, employeeId))
    .orderBy(desc(schema.benefitEnrollments.startDate));

  return rows.map((r) => ({
    id: r.id,
    benefitId: r.benefitId,
    employeeId: r.employeeId,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    benefit: {
      id: r.benefitId,
      name: r.benefitName,
      category: r.benefitCategory,
      provider: r.benefitProvider,
      cost: r.benefitCost,
      currency: r.benefitCurrency,
    },
  }));
}

export async function listEntities(db: Db) {
  return db.select({ id: schema.entities.id, code: schema.entities.code, name: schema.entities.name }).from(schema.entities);
}

export async function listBenefitKeys(db: Db) {
  return db.select({ id: schema.benefits.id, name: schema.benefits.name, entityId: schema.benefits.entityId }).from(schema.benefits);
}
