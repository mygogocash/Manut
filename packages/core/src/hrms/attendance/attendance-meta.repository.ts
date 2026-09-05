import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const emp = alias(schema.users, "meta_employee");

type PolicyInsert = Omit<typeof schema.attendancePolicies.$inferInsert, "id" | "createdAt" | "updatedAt">;
type ShiftInsert = Omit<typeof schema.attendanceShifts.$inferInsert, "id" | "createdAt" | "updatedAt">;
type EmployeeShiftInsert = Omit<typeof schema.attendanceEmployeeShifts.$inferInsert, "id" | "createdAt" | "updatedAt">;
type ExceptionInsert = Omit<typeof schema.attendanceExceptions.$inferInsert, "id" | "createdAt" | "updatedAt">;

const shift = alias(schema.attendanceShifts, "meta_shift");

export async function findPublicHolidayOnDate(
  db: Db,
  entityId: string | null | undefined,
  dateStr: string,
) {
  const conditions = [
    eq(schema.publicHolidays.date, dateStr),
    eq(schema.publicHolidays.isActive, true),
  ];
  if (entityId) conditions.push(eq(schema.publicHolidays.entityId, entityId));
  const [row] = await db
    .select({ name: schema.publicHolidays.name })
    .from(schema.publicHolidays)
    .where(and(...conditions))
    .limit(1);
  return row ?? null;
}

export async function findPublicHolidaysInRange(
  db: Db,
  from: string,
  to: string,
) {
  return db
    .select({
      date: schema.publicHolidays.date,
      entityId: schema.publicHolidays.entityId,
      name: schema.publicHolidays.name,
    })
    .from(schema.publicHolidays)
    .where(
      and(
        eq(schema.publicHolidays.isActive, true),
        gte(schema.publicHolidays.date, from),
        lte(schema.publicHolidays.date, to),
      ),
    );
}

export async function findApprovedExceptionOnDate(
  db: Db,
  employeeId: string,
  dateStr: string,
) {
  const [row] = await db
    .select({ id: schema.attendanceExceptions.id })
    .from(schema.attendanceExceptions)
    .where(
      and(
        eq(schema.attendanceExceptions.employeeId, employeeId),
        eq(schema.attendanceExceptions.status, "approved"),
        lte(schema.attendanceExceptions.startDate, dateStr),
        gte(schema.attendanceExceptions.endDate, dateStr),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findApprovedExceptionsInRange(
  db: Db,
  employeeIds: string[],
  from: string,
  to: string,
) {
  if (!employeeIds.length) return [];
  return db
    .select({
      employeeId: schema.attendanceExceptions.employeeId,
      startDate: schema.attendanceExceptions.startDate,
      endDate: schema.attendanceExceptions.endDate,
    })
    .from(schema.attendanceExceptions)
    .where(
      and(
        inArray(schema.attendanceExceptions.employeeId, employeeIds),
        eq(schema.attendanceExceptions.status, "approved"),
        lte(schema.attendanceExceptions.startDate, to),
        gte(schema.attendanceExceptions.endDate, from),
      ),
    );
}

export async function updatePolicyById(
  db: Db,
  id: string,
  data: Partial<typeof schema.attendancePolicies.$inferInsert>,
) {
  await db
    .update(schema.attendancePolicies)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.attendancePolicies.id, id));
  const [row] = await db
    .select()
    .from(schema.attendancePolicies)
    .where(eq(schema.attendancePolicies.id, id))
    .limit(1);
  return row ?? null;
}

export async function createPolicy(
  db: Db,
  data: PolicyInsert,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(schema.attendancePolicies)
    .values({ ...data, id, createdAt: now, updatedAt: now });
  const [row] = await db
    .select()
    .from(schema.attendancePolicies)
    .where(eq(schema.attendancePolicies.id, id))
    .limit(1);
  return row ?? null;
}

export async function listShifts(db: Db, entityId?: string | null) {
  const conditions = [eq(schema.attendanceShifts.active, true)];
  if (entityId !== undefined) {
    if (entityId === null) {
      conditions.push(isNull(schema.attendanceShifts.entityId));
    } else {
      conditions.push(
        or(
          eq(schema.attendanceShifts.entityId, entityId),
          isNull(schema.attendanceShifts.entityId),
        )!,
      );
    }
  }
  return db
    .select()
    .from(schema.attendanceShifts)
    .where(and(...conditions))
    .orderBy(asc(schema.attendanceShifts.shiftName));
}

export async function findShiftById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.attendanceShifts)
    .where(eq(schema.attendanceShifts.id, id))
    .limit(1);
  return row ?? null;
}

export async function createShift(
  db: Db,
  data: ShiftInsert,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(schema.attendanceShifts)
    .values({ ...data, id, createdAt: now, updatedAt: now });
  return findShiftById(db, id);
}

export async function updateShift(
  db: Db,
  id: string,
  data: Partial<typeof schema.attendanceShifts.$inferInsert>,
) {
  await db
    .update(schema.attendanceShifts)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.attendanceShifts.id, id));
  return findShiftById(db, id);
}

export async function createEmployeeShift(
  db: Db,
  data: EmployeeShiftInsert,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.attendanceEmployeeShifts).values({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select()
    .from(schema.attendanceEmployeeShifts)
    .where(eq(schema.attendanceEmployeeShifts.id, id))
    .limit(1);
  return row ?? null;
}

export async function findEmployeeShiftOnDate(
  db: Db,
  employeeId: string,
  dateStr: string,
) {
  const [row] = await db
    .select({ assignment: schema.attendanceEmployeeShifts, shift })
    .from(schema.attendanceEmployeeShifts)
    .innerJoin(shift, eq(schema.attendanceEmployeeShifts.shiftId, shift.id))
    .where(
      and(
        eq(schema.attendanceEmployeeShifts.employeeId, employeeId),
        lte(schema.attendanceEmployeeShifts.effectiveFrom, dateStr),
        or(
          isNull(schema.attendanceEmployeeShifts.effectiveTo),
          gte(schema.attendanceEmployeeShifts.effectiveTo, dateStr),
        ),
      ),
    )
    .orderBy(
      desc(schema.attendanceEmployeeShifts.effectiveFrom),
      desc(schema.attendanceEmployeeShifts.createdAt),
    )
    .limit(1);
  return row ?? null;
}

export async function listShiftAssignments(db: Db, entityId?: string | null) {
  const conditions = entityId ? [eq(emp.entityId, entityId)] : [];
  const rows = await db
    .select({ assignment: schema.attendanceEmployeeShifts, shift, employee: emp })
    .from(schema.attendanceEmployeeShifts)
    .innerJoin(shift, eq(schema.attendanceEmployeeShifts.shiftId, shift.id))
    .innerJoin(emp, eq(schema.attendanceEmployeeShifts.employeeId, emp.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(schema.attendanceEmployeeShifts.effectiveFrom),
      asc(emp.name),
    );
  return rows;
}

export async function findEmployeeShiftById(db: Db, id: string) {
  const [row] = await db
    .select({ assignment: schema.attendanceEmployeeShifts, shift })
    .from(schema.attendanceEmployeeShifts)
    .innerJoin(shift, eq(schema.attendanceEmployeeShifts.shiftId, shift.id))
    .where(eq(schema.attendanceEmployeeShifts.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateEmployeeShift(
  db: Db,
  id: string,
  data: Partial<typeof schema.attendanceEmployeeShifts.$inferInsert>,
) {
  await db
    .update(schema.attendanceEmployeeShifts)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.attendanceEmployeeShifts.id, id));
  return findEmployeeShiftById(db, id);
}

export async function listExceptions(
  db: Db,
  where: { employeeId?: string },
  page: number,
  limit: number,
) {
  const conditions = [];
  if (where.employeeId) conditions.push(eq(schema.attendanceExceptions.employeeId, where.employeeId));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({ exception: schema.attendanceExceptions, employee: emp })
    .from(schema.attendanceExceptions)
    .leftJoin(emp, eq(schema.attendanceExceptions.employeeId, emp.id))
    .where(whereClause)
    .orderBy(desc(schema.attendanceExceptions.startDate))
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db
    .select({ total: count() })
    .from(schema.attendanceExceptions)
    .where(whereClause);

  return {
    data: rows.map((r) => ({ ...r.exception, employee: r.employee })),
    total: totalRow?.total ?? 0,
  };
}

export async function createException(
  db: Db,
  data: ExceptionInsert,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.attendanceExceptions).values({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select({ exception: schema.attendanceExceptions, employee: emp })
    .from(schema.attendanceExceptions)
    .leftJoin(emp, eq(schema.attendanceExceptions.employeeId, emp.id))
    .where(eq(schema.attendanceExceptions.id, id))
    .limit(1);
  return row ? { ...row.exception, employee: row.employee } : null;
}

export async function findUserById(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      department: schema.users.department,
      employeeId: schema.users.employeeId,
      entityId: schema.users.entityId,
      timezone: schema.users.timezone,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return row ?? null;
}

export async function findActiveUsers(db: Db, filters?: { department?: string; entityId?: string }) {
  const conditions = [eq(schema.users.isActive, true)];
  if (filters?.department) conditions.push(eq(schema.users.department, filters.department));
  if (filters?.entityId) conditions.push(eq(schema.users.entityId, filters.entityId));
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      department: schema.users.department,
      employeeId: schema.users.employeeId,
      entityId: schema.users.entityId,
    })
    .from(schema.users)
    .where(and(...conditions))
    .orderBy(asc(schema.users.name));
}

export async function findLastAttendanceRecord(db: Db, employeeId: string) {
  const [row] = await db
    .select()
    .from(schema.attendanceRecords)
    .where(eq(schema.attendanceRecords.employeeId, employeeId))
    .orderBy(desc(schema.attendanceRecords.attendanceDate))
    .limit(1);
  return row ?? null;
}
