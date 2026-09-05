import { and, count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const emp = alias(schema.users, "correction_employee");

type CorrectionInsert = Omit<
  typeof schema.attendanceCorrections.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;

async function mapRow(db: Db, row: typeof schema.attendanceCorrections.$inferSelect) {
  const [employee] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      department: schema.users.department,
      employeeId: schema.users.employeeId,
    })
    .from(schema.users)
    .where(eq(schema.users.id, row.employeeId))
    .limit(1);
  return { ...row, employee: employee ?? null };
}

export async function create(db: Db, data: CorrectionInsert) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(schema.attendanceCorrections)
    .values({ ...data, id, createdAt: now, updatedAt: now });
  const [row] = await db
    .select()
    .from(schema.attendanceCorrections)
    .where(eq(schema.attendanceCorrections.id, id))
    .limit(1);
  return row ? mapRow(db, row) : null;
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.attendanceCorrections)
    .where(eq(schema.attendanceCorrections.id, id))
    .limit(1);
  return row ? mapRow(db, row) : null;
}

export async function findMany(
  db: Db,
  whereInput: {
    employeeId?: string | { in: string[] };
    attendanceDate?: string;
    status?: string;
  },
  page: number,
  limit: number,
) {
  const conditions = [];
  if (whereInput.employeeId) {
    if (typeof whereInput.employeeId === "string") {
      conditions.push(eq(schema.attendanceCorrections.employeeId, whereInput.employeeId));
    } else if (whereInput.employeeId.in.length) {
      conditions.push(inArray(schema.attendanceCorrections.employeeId, whereInput.employeeId.in));
    } else {
      conditions.push(eq(schema.attendanceCorrections.employeeId, "__none__"));
    }
  }
  if (whereInput.attendanceDate) {
    conditions.push(eq(schema.attendanceCorrections.attendanceDate, whereInput.attendanceDate));
  }
  if (whereInput.status) {
    conditions.push(eq(schema.attendanceCorrections.status, whereInput.status));
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.attendanceCorrections)
    .where(whereClause)
    .orderBy(desc(schema.attendanceCorrections.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db
    .select({ total: count() })
    .from(schema.attendanceCorrections)
    .where(whereClause);

  const data = await Promise.all(rows.map((r) => mapRow(db, r)));
  return { data, total: totalRow?.total ?? 0 };
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.attendanceCorrections.$inferInsert>,
) {
  await db
    .update(schema.attendanceCorrections)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.attendanceCorrections.id, id));
  return findById(db, id);
}

export async function countPendingForEmployeeIds(db: Db, employeeIds: string[]) {
  if (!employeeIds.length) return 0;
  const [row] = await db
    .select({ total: count() })
    .from(schema.attendanceCorrections)
    .where(
      and(
        inArray(schema.attendanceCorrections.employeeId, employeeIds),
        eq(schema.attendanceCorrections.status, "pending"),
      ),
    );
  return row?.total ?? 0;
}
