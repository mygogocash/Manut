import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";
import { resolveRate } from "./payroll.fx";

type DbLike = Db | DbTransaction;

const payrollEmployee = alias(schema.users, "payroll_employee");
const payrollRunner = alias(schema.users, "payroll_runner");
const payrollApprover = alias(schema.users, "payroll_approver");
const payslipEmployee = alias(schema.users, "payslip_employee");
const hrPayslipEmployee = alias(schema.users, "hr_payslip_employee");
const consultantUser = alias(schema.users, "consultant_user");

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapRunRow(row: {
  run: typeof schema.payrollRuns.$inferSelect;
  entityId: string;
  entityName: string;
  entityCurrency: string;
  runnerId: string;
  runnerName: string;
  runnerEmail: string;
  approverId: string | null;
  approverName: string | null;
  approverEmail: string | null;
}) {
  return {
    ...row.run,
    totalGross: num(row.run.totalGross),
    totalNet: num(row.run.totalNet),
    totalTax: num(row.run.totalTax),
    entity: {
      id: row.entityId,
      name: row.entityName,
      currency: row.entityCurrency,
    },
    runner: {
      id: row.runnerId,
      name: row.runnerName,
      email: row.runnerEmail,
    },
    approver: row.approverId
      ? {
          id: row.approverId,
          name: row.approverName ?? "",
          email: row.approverEmail ?? "",
        }
      : null,
  };
}

function mapPayslipEmployee(row: {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  jobTitle?: string | null;
  startDate?: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    ...(row.department !== undefined ? { department: row.department } : {}),
    ...(row.jobTitle !== undefined ? { jobTitle: row.jobTitle } : {}),
    ...(row.startDate !== undefined ? { startDate: row.startDate } : {}),
  };
}

async function loadRunBase(db: DbLike, id: string) {
  const [row] = await db
    .select({
      run: schema.payrollRuns,
      entityId: schema.entities.id,
      entityName: schema.entities.name,
      entityCurrency: schema.entities.currency,
      runnerId: payrollRunner.id,
      runnerName: payrollRunner.name,
      runnerEmail: payrollRunner.email,
      approverId: payrollApprover.id,
      approverName: payrollApprover.name,
      approverEmail: payrollApprover.email,
    })
    .from(schema.payrollRuns)
    .innerJoin(schema.entities, eq(schema.payrollRuns.entityId, schema.entities.id))
    .innerJoin(payrollRunner, eq(schema.payrollRuns.runBy, payrollRunner.id))
    .leftJoin(payrollApprover, eq(schema.payrollRuns.approvedBy, payrollApprover.id))
    .where(eq(schema.payrollRuns.id, id))
    .limit(1);
  return row ? mapRunRow(row) : null;
}

async function loadPayslipsForRun(db: DbLike, runId: string) {
  const rows = await db
    .select({
      payslip: schema.payslips,
      empId: payslipEmployee.id,
      empName: payslipEmployee.name,
      empEmail: payslipEmployee.email,
      empDept: payslipEmployee.department,
      empJobTitle: payslipEmployee.jobTitle,
      empStartDate: payslipEmployee.startDate,
    })
    .from(schema.payslips)
    .innerJoin(payslipEmployee, eq(schema.payslips.employeeId, payslipEmployee.id))
    .where(eq(schema.payslips.payrollRunId, runId))
    .orderBy(asc(payslipEmployee.name));
  return rows.map((r) => ({
    ...r.payslip,
    baseSalary: num(r.payslip.baseSalary),
    grossPay: num(r.payslip.grossPay),
    netPay: num(r.payslip.netPay),
    grossPayBase: r.payslip.grossPayBase != null ? num(r.payslip.grossPayBase) : null,
    netPayBase: r.payslip.netPayBase != null ? num(r.payslip.netPayBase) : null,
    employee: mapPayslipEmployee({
      id: r.empId,
      name: r.empName,
      email: r.empEmail,
      department: r.empDept,
      jobTitle: r.empJobTitle,
      startDate: r.empStartDate,
    }),
  }));
}

export async function findRuns(
  db: Db,
  filters: {
    entityId?: string;
    status?: string;
    period?: string;
    employeeIdScope?: string;
  },
  page: number,
  limit: number,
) {
  const parts: SQL[] = [];
  if (filters.entityId) parts.push(eq(schema.payrollRuns.entityId, filters.entityId));
  if (filters.status) parts.push(eq(schema.payrollRuns.status, filters.status));
  if (filters.period) parts.push(eq(schema.payrollRuns.period, filters.period));
  if (filters.employeeIdScope) {
    const scoped = db
      .select({ id: schema.payslips.payrollRunId })
      .from(schema.payslips)
      .where(eq(schema.payslips.employeeId, filters.employeeIdScope));
    parts.push(inArray(schema.payrollRuns.id, scoped));
  }
  const where = parts.length ? and(...parts) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(schema.payrollRuns)
    .where(where);
  const total = totalRow?.count ?? 0;

  const rows = await db
    .select({
      run: schema.payrollRuns,
      entityId: schema.entities.id,
      entityName: schema.entities.name,
      entityCurrency: schema.entities.currency,
      runnerId: payrollRunner.id,
      runnerName: payrollRunner.name,
      runnerEmail: payrollRunner.email,
      approverId: payrollApprover.id,
      approverName: payrollApprover.name,
      approverEmail: payrollApprover.email,
    })
    .from(schema.payrollRuns)
    .innerJoin(schema.entities, eq(schema.payrollRuns.entityId, schema.entities.id))
    .innerJoin(payrollRunner, eq(schema.payrollRuns.runBy, payrollRunner.id))
    .leftJoin(payrollApprover, eq(schema.payrollRuns.approvedBy, payrollApprover.id))
    .where(where)
    .orderBy(desc(schema.payrollRuns.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return { data: rows.map(mapRunRow), total };
}

export async function findRunById(db: DbLike, id: string) {
  const run = await loadRunBase(db, id);
  if (!run) return null;
  const payslips = await loadPayslipsForRun(db, id);
  return { ...run, payslips };
}

export async function findExistingRun(db: DbLike, entityId: string, period: string) {
  const [row] = await db
    .select()
    .from(schema.payrollRuns)
    .where(and(eq(schema.payrollRuns.entityId, entityId), eq(schema.payrollRuns.period, period)))
    .limit(1);
  return row ?? null;
}

export async function createRunWithPayslips(
  db: Db,
  data: {
    entityId: string;
    period: string;
    runBy: string;
    notes?: string;
  },
  employees: Array<{
    employeeId: string;
    baseSalary: number;
    allowances: Record<string, number> | null;
    deductions: Record<string, number> | null;
    grossPay: number;
    netPay: number;
    currency: string;
  }>,
) {
  const totalGross = employees.reduce((sum, e) => sum + e.grossPay, 0);
  const totalNet = employees.reduce((sum, e) => sum + e.netPay, 0);
  const totalTax = totalGross - totalNet;
  const runId = `payroll-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(schema.payrollRuns).values({
      id: runId,
      entityId: data.entityId,
      period: data.period,
      runBy: data.runBy,
      notes: data.notes ?? null,
      totalGross: String(totalGross),
      totalNet: String(totalNet),
      totalTax: String(totalTax),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    if (employees.length > 0) {
      await tx.insert(schema.payslips).values(
        employees.map((e) => ({
          id: crypto.randomUUID(),
          payrollRunId: runId,
          employeeId: e.employeeId,
          baseSalary: String(e.baseSalary),
          allowances: e.allowances,
          deductions: e.deductions,
          grossPay: String(e.grossPay),
          netPay: String(e.netPay),
          currency: e.currency,
        })),
      );
    }
  });

  return findRunById(db, runId);
}

export async function approveRun(db: DbLike, id: string, approvedBy: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.payrollRuns)
    .set({ status: "approved", approvedBy, approvedAt: now, updatedAt: now })
    .where(eq(schema.payrollRuns.id, id));
  return loadRunBase(db, id);
}

export async function deleteRun(db: DbLike, id: string) {
  await db.delete(schema.payrollRuns).where(eq(schema.payrollRuns.id, id));
}

export async function findPayslipById(db: DbLike, id: string) {
  const [row] = await db
    .select({
      payslip: schema.payslips,
      empId: payslipEmployee.id,
      empName: payslipEmployee.name,
      empEmail: payslipEmployee.email,
      empDept: payslipEmployee.department,
      empJobTitle: payslipEmployee.jobTitle,
      empStartDate: payslipEmployee.startDate,
    })
    .from(schema.payslips)
    .innerJoin(payslipEmployee, eq(schema.payslips.employeeId, payslipEmployee.id))
    .where(eq(schema.payslips.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.payslip,
    baseSalary: num(row.payslip.baseSalary),
    grossPay: num(row.payslip.grossPay),
    netPay: num(row.payslip.netPay),
    grossPayBase: row.payslip.grossPayBase != null ? num(row.payslip.grossPayBase) : null,
    netPayBase: row.payslip.netPayBase != null ? num(row.payslip.netPayBase) : null,
    employee: mapPayslipEmployee({
      id: row.empId,
      name: row.empName,
      email: row.empEmail,
      department: row.empDept,
      jobTitle: row.empJobTitle,
      startDate: row.empStartDate,
    }),
  };
}

export async function updatePayslip(
  db: DbLike,
  id: string,
  data: Partial<{
    baseSalary: number;
    allowances: Record<string, number> | null;
    deductions: Record<string, number> | null;
    currency: string;
    grossPay: number;
    netPay: number;
    documentUrl: string | null;
    positionSnapshot: string | null;
    departmentSnapshot: string | null;
    startDateSnapshot: string | null;
    grossPayBase: number | null;
    netPayBase: number | null;
  }>,
) {
  const patch: Record<string, unknown> = {};
  if (data.baseSalary !== undefined) patch.baseSalary = String(data.baseSalary);
  if (data.allowances !== undefined) patch.allowances = data.allowances;
  if (data.deductions !== undefined) patch.deductions = data.deductions;
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.grossPay !== undefined) patch.grossPay = String(data.grossPay);
  if (data.netPay !== undefined) patch.netPay = String(data.netPay);
  if (data.documentUrl !== undefined) patch.documentUrl = data.documentUrl;
  if (data.positionSnapshot !== undefined) patch.positionSnapshot = data.positionSnapshot;
  if (data.departmentSnapshot !== undefined) patch.departmentSnapshot = data.departmentSnapshot;
  if (data.startDateSnapshot !== undefined) patch.startDateSnapshot = data.startDateSnapshot;
  if (data.grossPayBase !== undefined) {
    patch.grossPayBase = data.grossPayBase == null ? null : String(data.grossPayBase);
  }
  if (data.netPayBase !== undefined) {
    patch.netPayBase = data.netPayBase == null ? null : String(data.netPayBase);
  }
  if (Object.keys(patch).length > 0) {
    await db.update(schema.payslips).set(patch).where(eq(schema.payslips.id, id));
  }
  return findPayslipById(db, id);
}

export async function findPayslipDocumentUrls(db: DbLike, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({ id: schema.payslips.id, documentUrl: schema.payslips.documentUrl })
    .from(schema.payslips)
    .where(inArray(schema.payslips.id, ids));
}

export async function bulkDeletePayslips(db: DbLike, ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  const deleted = await db
    .delete(schema.payslips)
    .where(inArray(schema.payslips.id, ids))
    .returning({ id: schema.payslips.id });
  return { count: deleted.length };
}

export async function sumPayslipTotalsForRun(db: DbLike, runId: string) {
  const run = await loadRunBase(db, runId);
  const headlineCurrency = run?.entity.currency ?? null;

  const rows = await db
    .select({
      grossPay: schema.payslips.grossPay,
      netPay: schema.payslips.netPay,
      grossPayBase: schema.payslips.grossPayBase,
      netPayBase: schema.payslips.netPayBase,
      currency: schema.payslips.currency,
    })
    .from(schema.payslips)
    .where(eq(schema.payslips.payrollRunId, runId));

  const currencyTotals: Record<
    string,
    { gross: number; tax: number; net: number; count: number }
  > = {};
  for (const r of rows) {
    const gross = num(r.grossPay);
    const net = num(r.netPay);
    const bucket = (currencyTotals[r.currency] ??= { gross: 0, tax: 0, net: 0, count: 0 });
    bucket.gross += gross;
    bucket.net += net;
    bucket.tax += gross - net;
    bucket.count += 1;
  }

  let headlineGross = 0;
  let headlineNet = 0;
  const missingFxFor = new Set<string>();
  if (headlineCurrency) {
    for (const r of rows) {
      const gross = num(r.grossPay);
      const net = num(r.netPay);
      if (r.netPayBase != null && r.grossPayBase != null) {
        headlineGross += num(r.grossPayBase);
        headlineNet += num(r.netPayBase);
        continue;
      }
      if (r.currency === headlineCurrency) {
        headlineGross += gross;
        headlineNet += net;
        continue;
      }
      const { rate, source } = await resolveRate(db as Db, r.currency, headlineCurrency);
      if (source === "missing") {
        missingFxFor.add(r.currency);
        continue;
      }
      headlineGross += gross * rate;
      headlineNet += net * rate;
    }
  }

  return {
    totalGross: headlineGross,
    totalNet: headlineNet,
    totalTax: headlineGross - headlineNet,
    currencyTotals,
    missingFxFor: Array.from(missingFxFor).sort(),
  };
}

export async function setRunTotals(
  db: DbLike,
  runId: string,
  totals: {
    totalGross: number;
    totalNet: number;
    totalTax: number;
    currencyTotals?: Record<
      string,
      { gross: number; tax: number; net: number; count: number }
    > | null;
  },
) {
  const now = new Date().toISOString();
  await db
    .update(schema.payrollRuns)
    .set({
      totalGross: String(totals.totalGross),
      totalNet: String(totals.totalNet),
      totalTax: String(totals.totalTax),
      ...(totals.currencyTotals !== undefined && {
        currencyTotals: totals.currencyTotals,
      }),
      updatedAt: now,
    })
    .where(eq(schema.payrollRuns.id, runId));
}

export async function findEmployeesByEntity(
  db: DbLike,
  entityId: string,
  employeeId?: string,
) {
  const parts: SQL[] = [
    eq(schema.users.entityId, entityId),
    eq(schema.users.isActive, true),
    eq(schema.users.employmentType, "full_time"),
  ];
  if (employeeId) parts.push(eq(schema.users.id, employeeId));
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      salary: schema.users.salary,
      currency: schema.users.currency,
    })
    .from(schema.users)
    .where(and(...parts));
}

export async function findUsersByIds(db: DbLike, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.id, ids));
}

export async function findUsersByEmails(db: DbLike, emails: string[]) {
  if (emails.length === 0) return [];
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.email, emails));
}

export async function findUsersForBulkMatch(db: DbLike) {
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users);
}

export async function findUsersForImportMatch(db: DbLike) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      entityId: schema.users.entityId,
    })
    .from(schema.users);
}

export async function createEmptyRun(
  db: Db,
  data: {
    entityId: string;
    period: string;
    runBy: string;
    notes?: string;
  },
) {
  const runId = `payroll-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.insert(schema.payrollRuns).values({
    id: runId,
    entityId: data.entityId,
    period: data.period,
    runBy: data.runBy,
    notes: data.notes ?? null,
    totalGross: "0",
    totalNet: "0",
    totalTax: "0",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  return findRunById(db, runId);
}

export async function runPayslipImportTransaction(
  db: Db,
  payrollRunId: string,
  rows: Array<{
    employeeId: string;
    baseSalary: number;
    allowances: Record<string, number> | null;
    deductions: Record<string, number> | null;
    grossPay: number;
    netPay: number;
    grossPayBase?: number | null;
    netPayBase?: number | null;
    currency: string;
    positionSnapshot?: string | null;
    departmentSnapshot?: string | null;
    startDateSnapshot?: string | null;
  }>,
) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.payslips).where(eq(schema.payslips.payrollRunId, payrollRunId));
    if (rows.length > 0) {
      await tx.insert(schema.payslips).values(
        rows.map((row) => ({
          id: crypto.randomUUID(),
          payrollRunId,
          employeeId: row.employeeId,
          baseSalary: String(row.baseSalary),
          allowances: row.allowances,
          deductions: row.deductions,
          grossPay: String(row.grossPay),
          netPay: String(row.netPay),
          grossPayBase: row.grossPayBase != null ? String(row.grossPayBase) : null,
          netPayBase: row.netPayBase != null ? String(row.netPayBase) : null,
          currency: row.currency,
          positionSnapshot: row.positionSnapshot ?? null,
          departmentSnapshot: row.departmentSnapshot ?? null,
          startDateSnapshot: row.startDateSnapshot ?? null,
        })),
      );
    }
  });
}

export async function findConsultantInvoices(
  db: Db,
  filters: {
    entityId?: string;
    status?: string;
    period?: string;
    consultantIdScope?: string;
  },
  page: number,
  limit: number,
) {
  const parts: SQL[] = [];
  if (filters.entityId) parts.push(eq(schema.consultantInvoices.entityId, filters.entityId));
  if (filters.status) parts.push(eq(schema.consultantInvoices.status, filters.status));
  if (filters.period) parts.push(eq(schema.consultantInvoices.period, filters.period));
  if (filters.consultantIdScope) {
    parts.push(eq(schema.consultantInvoices.consultantId, filters.consultantIdScope));
  }
  const where = parts.length ? and(...parts) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(schema.consultantInvoices)
    .where(where);
  const total = totalRow?.count ?? 0;

  const rows = await db
    .select({
      invoice: schema.consultantInvoices,
      entityId: schema.entities.id,
      entityName: schema.entities.name,
      consultantId: consultantUser.id,
      consultantName: consultantUser.name,
      consultantEmail: consultantUser.email,
    })
    .from(schema.consultantInvoices)
    .innerJoin(schema.entities, eq(schema.consultantInvoices.entityId, schema.entities.id))
    .innerJoin(consultantUser, eq(schema.consultantInvoices.consultantId, consultantUser.id))
    .where(where)
    .orderBy(desc(schema.consultantInvoices.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const data = rows.map((r) => ({
    ...r.invoice,
    amount: num(r.invoice.amount),
    whtRate: num(r.invoice.whtRate),
    whtAmount: num(r.invoice.whtAmount),
    netAmount: num(r.invoice.netAmount),
    entity: { id: r.entityId, name: r.entityName },
    consultant: { id: r.consultantId, name: r.consultantName, email: r.consultantEmail },
  }));
  return { data, total };
}

export async function createConsultantInvoice(
  db: DbLike,
  data: {
    entityId: string;
    consultantId: string;
    invoiceNo: string;
    amount: number;
    whtRate: number;
    whtAmount: number;
    netAmount: number;
    period: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.consultantInvoices).values({
    id,
    entityId: data.entityId,
    consultantId: data.consultantId,
    invoiceNo: data.invoiceNo,
    amount: String(data.amount),
    whtRate: String(data.whtRate),
    whtAmount: String(data.whtAmount),
    netAmount: String(data.netAmount),
    period: data.period,
    status: "pending",
    createdAt: now,
  });
  const [row] = await db
    .select({
      invoice: schema.consultantInvoices,
      entityId: schema.entities.id,
      entityName: schema.entities.name,
      consultantId: consultantUser.id,
      consultantName: consultantUser.name,
      consultantEmail: consultantUser.email,
    })
    .from(schema.consultantInvoices)
    .innerJoin(schema.entities, eq(schema.consultantInvoices.entityId, schema.entities.id))
    .innerJoin(consultantUser, eq(schema.consultantInvoices.consultantId, consultantUser.id))
    .where(eq(schema.consultantInvoices.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.invoice,
    amount: num(row.invoice.amount),
    whtRate: num(row.invoice.whtRate),
    whtAmount: num(row.invoice.whtAmount),
    netAmount: num(row.invoice.netAmount),
    entity: { id: row.entityId, name: row.entityName },
    consultant: { id: row.consultantId, name: row.consultantName, email: row.consultantEmail },
  };
}

export async function findPayslipsByEmployeeId(db: DbLike, employeeId: string) {
  const rows = await db
    .select({
      payslip: schema.payslips,
      runId: schema.payrollRuns.id,
      runPeriod: schema.payrollRuns.period,
      runStatus: schema.payrollRuns.status,
      entityId: schema.entities.id,
      entityName: schema.entities.name,
    })
    .from(schema.payslips)
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .innerJoin(schema.entities, eq(schema.payrollRuns.entityId, schema.entities.id))
    .where(eq(schema.payslips.employeeId, employeeId))
    .orderBy(desc(schema.payrollRuns.period), asc(schema.payslips.currency));
  return rows.map((r) => ({
    ...r.payslip,
    baseSalary: num(r.payslip.baseSalary),
    grossPay: num(r.payslip.grossPay),
    netPay: num(r.payslip.netPay),
    grossPayBase: r.payslip.grossPayBase != null ? num(r.payslip.grossPayBase) : null,
    netPayBase: r.payslip.netPayBase != null ? num(r.payslip.netPayBase) : null,
    payrollRun: {
      id: r.runId,
      period: r.runPeriod,
      status: r.runStatus,
      entity: { id: r.entityId, name: r.entityName },
    },
  }));
}

export async function createPayslip(
  db: DbLike,
  data: {
    payrollRunId: string;
    employeeId: string;
    baseSalary: number;
    allowances: Record<string, number> | null;
    deductions: Record<string, number> | null;
    currency: string;
    grossPay: number;
    netPay: number;
    positionSnapshot?: string | null;
    departmentSnapshot?: string | null;
    startDateSnapshot?: string | null;
  },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.payslips).values({
    id,
    payrollRunId: data.payrollRunId,
    employeeId: data.employeeId,
    baseSalary: String(data.baseSalary),
    allowances: data.allowances,
    deductions: data.deductions,
    grossPay: String(data.grossPay),
    netPay: String(data.netPay),
    currency: data.currency,
    positionSnapshot: data.positionSnapshot ?? null,
    departmentSnapshot: data.departmentSnapshot ?? null,
    startDateSnapshot: data.startDateSnapshot ?? null,
  });
  return findPayslipById(db, id);
}

export async function findPayslipsForHr(
  db: DbLike,
  filters: {
    employeeId?: string;
    entityId?: string;
    period?: string;
    hasDocument?: boolean;
  },
) {
  const parts: SQL[] = [];
  if (filters.employeeId) parts.push(eq(schema.payslips.employeeId, filters.employeeId));
  if (filters.period) parts.push(eq(schema.payrollRuns.period, filters.period));
  if (filters.entityId) parts.push(eq(schema.payrollRuns.entityId, filters.entityId));
  if (filters.hasDocument === true) parts.push(isNotNull(schema.payslips.documentUrl));
  if (filters.hasDocument === false) parts.push(isNull(schema.payslips.documentUrl));

  const rows = await db
    .select({
      payslip: schema.payslips,
      empId: hrPayslipEmployee.id,
      empName: hrPayslipEmployee.name,
      empEmail: hrPayslipEmployee.email,
      empDept: hrPayslipEmployee.department,
      runId: schema.payrollRuns.id,
      runPeriod: schema.payrollRuns.period,
      runStatus: schema.payrollRuns.status,
      entityId: schema.entities.id,
      entityName: schema.entities.name,
    })
    .from(schema.payslips)
    .innerJoin(hrPayslipEmployee, eq(schema.payslips.employeeId, hrPayslipEmployee.id))
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .innerJoin(schema.entities, eq(schema.payrollRuns.entityId, schema.entities.id))
    .where(parts.length ? and(...parts) : undefined)
    .orderBy(desc(schema.payrollRuns.period), asc(hrPayslipEmployee.name));

  return rows.map((r) => ({
    ...r.payslip,
    baseSalary: num(r.payslip.baseSalary),
    grossPay: num(r.payslip.grossPay),
    netPay: num(r.payslip.netPay),
    grossPayBase: r.payslip.grossPayBase != null ? num(r.payslip.grossPayBase) : null,
    netPayBase: r.payslip.netPayBase != null ? num(r.payslip.netPayBase) : null,
    employee: {
      id: r.empId,
      name: r.empName,
      email: r.empEmail,
      department: r.empDept,
    },
    payrollRun: {
      id: r.runId,
      period: r.runPeriod,
      status: r.runStatus,
      entity: { id: r.entityId, name: r.entityName },
    },
  }));
}

export async function findPayslipWithRunForExport(db: DbLike, payslipId: string) {
  const [row] = await db
    .select({
      payslip: schema.payslips,
      empId: payslipEmployee.id,
      empName: payslipEmployee.name,
      empEmail: payslipEmployee.email,
      empDob: payslipEmployee.dateOfBirth,
      runPeriod: schema.payrollRuns.period,
      runStatus: schema.payrollRuns.status,
      entityName: schema.entities.name,
    })
    .from(schema.payslips)
    .innerJoin(payslipEmployee, eq(schema.payslips.employeeId, payslipEmployee.id))
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .innerJoin(schema.entities, eq(schema.payrollRuns.entityId, schema.entities.id))
    .where(eq(schema.payslips.id, payslipId))
    .limit(1);
  if (!row) return null;
  return {
    payslip: {
      ...row.payslip,
      baseSalary: num(row.payslip.baseSalary),
      grossPay: num(row.payslip.grossPay),
      netPay: num(row.payslip.netPay),
      grossPayBase: row.payslip.grossPayBase != null ? num(row.payslip.grossPayBase) : null,
      netPayBase: row.payslip.netPayBase != null ? num(row.payslip.netPayBase) : null,
      employee: {
        id: row.empId,
        name: row.empName,
        email: row.empEmail,
        dateOfBirth: row.empDob,
      },
    },
    payrollRun: {
      period: row.runPeriod,
      status: row.runStatus,
      entity: { name: row.entityName },
    },
  };
}

export async function findPayslipsForRunExport(db: DbLike, runId: string) {
  const rows = await db
    .select({
      payslip: schema.payslips,
      empId: payslipEmployee.id,
      empName: payslipEmployee.name,
      empEmail: payslipEmployee.email,
    })
    .from(schema.payslips)
    .innerJoin(payslipEmployee, eq(schema.payslips.employeeId, payslipEmployee.id))
    .where(eq(schema.payslips.payrollRunId, runId))
    .orderBy(asc(payslipEmployee.name), asc(schema.payslips.currency));
  return rows.map((r) => ({
    ...r.payslip,
    baseSalary: num(r.payslip.baseSalary),
    grossPay: num(r.payslip.grossPay),
    netPay: num(r.payslip.netPay),
    grossPayBase: r.payslip.grossPayBase != null ? num(r.payslip.grossPayBase) : null,
    netPayBase: r.payslip.netPayBase != null ? num(r.payslip.netPayBase) : null,
    employee: { id: r.empId, name: r.empName, email: r.empEmail },
  }));
}

export async function countPayslipsByEmployee(db: DbLike, employeeId: string) {
  const [row] = await db
    .select({ count: count() })
    .from(schema.payslips)
    .where(eq(schema.payslips.employeeId, employeeId));
  return row?.count ?? 0;
}

export async function findEntityById(db: DbLike, entityId: string) {
  const [row] = await db
    .select({ id: schema.entities.id, code: schema.entities.code, name: schema.entities.name })
    .from(schema.entities)
    .where(eq(schema.entities.id, entityId))
    .limit(1);
  return row ?? null;
}

export async function findUserByEmail(db: DbLike, email: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      isActive: schema.users.isActive,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return row ?? null;
}

export async function findAllUsersForDiagnose(db: DbLike) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      isActive: schema.users.isActive,
    })
    .from(schema.users);
}
