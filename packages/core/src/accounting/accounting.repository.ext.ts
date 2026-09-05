import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";
import { PERMISSIONS } from "@nexora/contracts";
import { createCuid } from "../lib/id";
import { getSetting, upsertSetting } from "../survey/system-settings.repository";
import { SECOND_APPROVAL_KEY } from "./second-approval.defaults";

type DbLike = Db | DbTransaction;

export const GL_LIVE_STATUSES = ["posted", "reversed"] as const;

const entitySetupColumns = {
  id: schema.entities.id,
  name: schema.entities.name,
  code: schema.entities.code,
  country: schema.entities.country,
  currency: schema.entities.currency,
  taxId: schema.entities.taxId,
  address: schema.entities.address,
  nameTh: schema.entities.nameTh,
  branchCode: schema.entities.branchCode,
  logoUrl: schema.entities.logoUrl,
  vatRegistrationStatus: schema.entities.vatRegistrationStatus,
  boiType: schema.entities.boiType,
  boiPeriod: schema.entities.boiPeriod,
  fiscalYearStartMonth: schema.entities.fiscalYearStartMonth,
  firstFiscalYearStart: schema.entities.firstFiscalYearStart,
  firstFiscalYearEnd: schema.entities.firstFiscalYearEnd,
  defaultRateSource: schema.entities.defaultRateSource,
  enabledCurrencies: schema.entities.enabledCurrencies,
  setupState: schema.entities.setupState,
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ilikeTerm(term: string) {
  return `%${term}%`;
}

// ── Account mappings ────────────────────────────────────────────────────────

export async function findAccountMappings(db: Db, entityId: string) {
  const rows = await db
    .select({
      role: schema.accountMappings.role,
      chartOfAccountId: schema.accountMappings.chartOfAccountId,
      accountId: schema.chartOfAccounts.id,
      code: schema.chartOfAccounts.code,
      name: schema.chartOfAccounts.name,
      type: schema.chartOfAccounts.type,
    })
    .from(schema.accountMappings)
    .innerJoin(
      schema.chartOfAccounts,
      eq(schema.accountMappings.chartOfAccountId, schema.chartOfAccounts.id),
    )
    .where(eq(schema.accountMappings.entityId, entityId))
    .orderBy(asc(schema.accountMappings.role));

  return rows.map((r) => ({
    role: r.role,
    chartOfAccountId: r.chartOfAccountId,
    account: r.accountId
      ? { id: r.accountId, code: r.code, name: r.name, type: r.type }
      : null,
  }));
}

export async function findAccountForMapping(db: Db, entityId: string, id: string) {
  const [row] = await db
    .select({
      id: schema.chartOfAccounts.id,
      code: schema.chartOfAccounts.code,
      name: schema.chartOfAccounts.name,
      type: schema.chartOfAccounts.type,
    })
    .from(schema.chartOfAccounts)
    .where(
      and(
        eq(schema.chartOfAccounts.id, id),
        eq(schema.chartOfAccounts.entityId, entityId),
        isNull(schema.chartOfAccounts.deletedAt),
        eq(schema.chartOfAccounts.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertAccountMapping(
  db: Db,
  entityId: string,
  role: string,
  chartOfAccountId: string,
) {
  const now = new Date().toISOString();
  const id = createCuid();
  await db
    .insert(schema.accountMappings)
    .values({ id, entityId, role, chartOfAccountId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [schema.accountMappings.entityId, schema.accountMappings.role],
      set: { chartOfAccountId, updatedAt: now },
    });
}

export async function deleteAccountMapping(db: Db, entityId: string, role: string) {
  await db
    .delete(schema.accountMappings)
    .where(and(eq(schema.accountMappings.entityId, entityId), eq(schema.accountMappings.role, role)));
}

export async function listEntityIdsWithAccounts(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ entityId: schema.chartOfAccounts.entityId })
    .from(schema.chartOfAccounts)
    .where(isNull(schema.chartOfAccounts.deletedAt))
    .orderBy(asc(schema.chartOfAccounts.entityId));
  return rows.map((r) => r.entityId);
}

// ── Company setup ───────────────────────────────────────────────────────────

export async function findEntitySetup(db: Db, entityId: string) {
  const [row] = await db
    .select(entitySetupColumns)
    .from(schema.entities)
    .where(and(eq(schema.entities.id, entityId), isNull(schema.entities.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function updateEntitySetup(
  db: Db,
  entityId: string,
  patch: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.entities)
    .set({ ...patch, updatedAt: now })
    .where(eq(schema.entities.id, entityId));
  return findEntitySetup(db, entityId);
}

export async function getEntitySetupState(db: Db, entityId: string) {
  const [row] = await db
    .select({ setupState: schema.entities.setupState })
    .from(schema.entities)
    .where(eq(schema.entities.id, entityId))
    .limit(1);
  return row?.setupState ?? null;
}

export async function countActiveAccounts(db: Db, entityId: string) {
  const [row] = await db
    .select({ total: countDistinct(schema.chartOfAccounts.id) })
    .from(schema.chartOfAccounts)
    .where(
      and(
        eq(schema.chartOfAccounts.entityId, entityId),
        eq(schema.chartOfAccounts.isActive, true),
        isNull(schema.chartOfAccounts.deletedAt),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function hasOpeningEntry(db: Db, entityId: string) {
  const [row] = await db
    .select({ id: schema.journalEntries.id })
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.entityId, entityId),
        eq(schema.journalEntries.sourceType, "opening"),
        isNull(schema.journalEntries.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function findOpeningEntry(db: Db, entityId: string) {
  const [row] = await db
    .select({
      id: schema.journalEntries.id,
      entryNo: schema.journalEntries.entryNo,
      date: schema.journalEntries.date,
      description: schema.journalEntries.description,
      status: schema.journalEntries.status,
      postedAt: schema.journalEntries.postedAt,
      createdAt: schema.journalEntries.createdAt,
    })
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.entityId, entityId),
        eq(schema.journalEntries.sourceType, "opening"),
        isNull(schema.journalEntries.deletedAt),
      ),
    )
    .orderBy(asc(schema.journalEntries.createdAt))
    .limit(1);
  return row ?? null;
}

export async function findActiveAccountIds(db: Db, entityId: string) {
  const rows = await db
    .select({ id: schema.chartOfAccounts.id })
    .from(schema.chartOfAccounts)
    .where(
      and(
        eq(schema.chartOfAccounts.entityId, entityId),
        eq(schema.chartOfAccounts.isActive, true),
        isNull(schema.chartOfAccounts.deletedAt),
      ),
    );
  return rows.map((r) => r.id);
}

// ── Tax codes ───────────────────────────────────────────────────────────────

async function mapTaxCodeRow(
  db: DbLike,
  row: typeof schema.taxCodes.$inferSelect,
) {
  let glAccount = null as { id: string; code: string; name: string; type: string } | null;
  if (row.glAccountId) {
    const [acc] = await db
      .select({
        id: schema.chartOfAccounts.id,
        code: schema.chartOfAccounts.code,
        name: schema.chartOfAccounts.name,
        type: schema.chartOfAccounts.type,
      })
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.id, row.glAccountId))
      .limit(1);
    glAccount = acc ?? null;
  }
  return { ...row, rate: num(row.rate), glAccount };
}

export async function findTaxCodes(db: Db, entityId: string, includeInactive: boolean) {
  const conditions: SQL[] = [eq(schema.taxCodes.entityId, entityId)];
  if (!includeInactive) conditions.push(eq(schema.taxCodes.isActive, true));
  const rows = await db
    .select()
    .from(schema.taxCodes)
    .where(and(...conditions))
    .orderBy(asc(schema.taxCodes.kind), asc(schema.taxCodes.code));
  return Promise.all(rows.map((r) => mapTaxCodeRow(db, r)));
}

export async function findTaxCodeById(db: Db, id: string) {
  const [row] = await db.select().from(schema.taxCodes).where(eq(schema.taxCodes.id, id)).limit(1);
  if (!row) return null;
  return mapTaxCodeRow(db, row);
}

export async function findTaxCodeByEntityAndCode(db: Db, entityId: string, code: string) {
  const [row] = await db
    .select()
    .from(schema.taxCodes)
    .where(and(eq(schema.taxCodes.entityId, entityId), eq(schema.taxCodes.code, code)))
    .limit(1);
  return row ?? null;
}

export async function createTaxCode(
  db: Db,
  data: {
    entityId: string;
    code: string;
    name: string;
    kind: string;
    rate: number;
    glAccountId: string | null;
    isActive: boolean;
  },
) {
  const now = new Date().toISOString();
  const id = createCuid();
  const [row] = await db
    .insert(schema.taxCodes)
    .values({
      id,
      entityId: data.entityId,
      code: data.code,
      name: data.name,
      kind: data.kind,
      rate: String(data.rate),
      glAccountId: data.glAccountId,
      isActive: data.isActive,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapTaxCodeRow(db, row!);
}

export async function updateTaxCode(db: Db, id: string, patch: Record<string, unknown>) {
  const now = new Date().toISOString();
  const [row] = await db
    .update(schema.taxCodes)
    .set({ ...patch, updatedAt: now })
    .where(eq(schema.taxCodes.id, id))
    .returning();
  return row ? mapTaxCodeRow(db, row) : null;
}

export async function deleteTaxCode(db: Db, id: string) {
  await db.delete(schema.taxCodes).where(eq(schema.taxCodes.id, id));
  return { success: true };
}

// ── Second approval ─────────────────────────────────────────────────────────

export async function getSecondApprovalSetting(db: Db) {
  return getSetting(db, SECOND_APPROVAL_KEY);
}

export async function upsertSecondApprovalSetting(db: Db, value: unknown) {
  await upsertSetting(db, SECOND_APPROVAL_KEY, value);
}

export async function countApprovers(db: Db, permissionCode: string) {
  const rows = await db
    .selectDistinct({ userId: schema.userRoles.userId })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .innerJoin(schema.users, eq(schema.userRoles.userId, schema.users.id))
    .leftJoin(
      schema.rolePermissions,
      eq(schema.rolePermissions.roleId, schema.roles.id),
    )
    .where(
      and(
        isNull(schema.roles.deletedAt),
        isNull(schema.users.deletedAt),
        eq(schema.users.isActive, true),
        or(
          eq(schema.rolePermissions.permissionCode, permissionCode),
          and(eq(schema.roles.isSystem, true), eq(schema.roles.name, "Admin")),
        ),
      ),
    );
  return rows.length;
}

// ── Journal reversals ───────────────────────────────────────────────────────

export async function findJournalReversals(
  db: Db,
  filters: { startDate: string; endDate: string; entityId?: string },
) {
  const original = alias(schema.journalEntries, "original_entry");
  const conditions: SQL[] = [
    isNull(schema.journalEntries.deletedAt),
    isNotNull(schema.journalEntries.reversesEntryId),
    gte(schema.journalEntries.date, filters.startDate),
    lte(schema.journalEntries.date, filters.endDate),
  ];
  if (filters.entityId) conditions.push(eq(schema.journalEntries.entityId, filters.entityId));

  return db
    .select({
      id: schema.journalEntries.id,
      entryNo: schema.journalEntries.entryNo,
      date: schema.journalEntries.date,
      description: schema.journalEntries.description,
      createdBy: schema.journalEntries.createdBy,
      createdAt: schema.journalEntries.createdAt,
      originalId: original.id,
      originalEntryNo: original.entryNo,
      originalDate: original.date,
      originalCancelReason: original.cancelReason,
      originalCancelledBy: original.cancelledBy,
      originalCancelledAt: original.cancelledAt,
    })
    .from(schema.journalEntries)
    .leftJoin(original, eq(schema.journalEntries.reversesEntryId, original.id))
    .where(and(...conditions))
    .orderBy(asc(schema.journalEntries.date), asc(schema.journalEntries.entryNo));
}

// ── Reporting activity ──────────────────────────────────────────────────────

export async function getAccountActivity(
  db: Db,
  filters: {
    entityId?: string;
    from?: string;
    to?: string;
    types?: string[];
  },
) {
  const conditions: SQL[] = [
    inArray(schema.journalEntries.status, [...GL_LIVE_STATUSES]),
    isNull(schema.journalEntries.deletedAt),
    isNull(schema.chartOfAccounts.deletedAt),
  ];
  if (filters.entityId) conditions.push(eq(schema.journalEntries.entityId, filters.entityId));
  if (filters.from) conditions.push(gte(schema.journalEntries.date, filters.from));
  if (filters.to) conditions.push(lte(schema.journalEntries.date, filters.to));
  if (filters.types?.length) conditions.push(inArray(schema.chartOfAccounts.type, filters.types));

  const grouped = await db
    .select({
      accountId: schema.journalEntryLines.accountId,
      debit: sql<string>`coalesce(sum(${schema.journalEntryLines.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${schema.journalEntryLines.credit}), 0)`,
    })
    .from(schema.journalEntryLines)
    .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.entryId, schema.journalEntries.id))
    .innerJoin(schema.chartOfAccounts, eq(schema.journalEntryLines.accountId, schema.chartOfAccounts.id))
    .where(and(...conditions))
    .groupBy(schema.journalEntryLines.accountId);

  if (grouped.length === 0) return [];

  const accountIds = grouped.map((g) => g.accountId);
  const accounts = await db
    .select({
      id: schema.chartOfAccounts.id,
      code: schema.chartOfAccounts.code,
      name: schema.chartOfAccounts.name,
      type: schema.chartOfAccounts.type,
      subType: schema.chartOfAccounts.subType,
    })
    .from(schema.chartOfAccounts)
    .where(inArray(schema.chartOfAccounts.id, accountIds));
  const byId = new Map(accounts.map((a) => [a.id, a]));

  return grouped.flatMap((row) => {
    const account = byId.get(row.accountId);
    if (!account) return [];
    return [
      {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        subType: account.subType,
        debit: num(row.debit),
        credit: num(row.credit),
      },
    ];
  });
}

export async function getCashAccountIds(db: Db, entityId?: string) {
  const conditions: SQL[] = [
    isNull(schema.bankAccounts.deletedAt),
    isNotNull(schema.bankAccounts.glAccountId),
  ];
  if (entityId) conditions.push(eq(schema.bankAccounts.entityId, entityId));
  const rows = await db
    .select({ glAccountId: schema.bankAccounts.glAccountId })
    .from(schema.bankAccounts)
    .where(and(...conditions));
  return [...new Set(rows.map((r) => r.glAccountId).filter((id): id is string => id != null))];
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function searchInvoices(
  db: Db,
  term: string,
  opts: { entityId?: string; createdBy?: string; amount?: number },
  limit: number,
) {
  const textOr = or(
    ilike(schema.invoices.invoiceNo, ilikeTerm(term)),
    ilike(schema.invoices.counterparty, ilikeTerm(term)),
    ilike(schema.invoices.reference, ilikeTerm(term)),
    ilike(schema.invoices.notes, ilikeTerm(term)),
  );
  const conditions: SQL[] = [isNull(schema.invoices.deletedAt), textOr!];
  if (opts.entityId) conditions.push(eq(schema.invoices.entityId, opts.entityId));
  if (opts.createdBy) conditions.push(eq(schema.invoices.createdBy, opts.createdBy));
  if (opts.amount != null) {
    return db
      .select({
        id: schema.invoices.id,
        invoiceNo: schema.invoices.invoiceNo,
        type: schema.invoices.type,
        counterparty: schema.invoices.counterparty,
        amount: schema.invoices.amount,
        currency: schema.invoices.currency,
        status: schema.invoices.status,
        issueDate: schema.invoices.issueDate,
      })
      .from(schema.invoices)
      .where(and(...conditions, eq(schema.invoices.amount, String(opts.amount))))
      .orderBy(desc(schema.invoices.issueDate))
      .limit(limit);
  }
  return db
    .select({
      id: schema.invoices.id,
      invoiceNo: schema.invoices.invoiceNo,
      type: schema.invoices.type,
      counterparty: schema.invoices.counterparty,
      amount: schema.invoices.amount,
      currency: schema.invoices.currency,
      status: schema.invoices.status,
      issueDate: schema.invoices.issueDate,
    })
    .from(schema.invoices)
    .where(and(...conditions))
    .orderBy(desc(schema.invoices.issueDate))
    .limit(limit);
}

export async function searchJournals(
  db: Db,
  term: string,
  opts: { entityId?: string },
  limit: number,
) {
  const conditions: SQL[] = [
    isNull(schema.journalEntries.deletedAt),
    or(
      ilike(schema.journalEntries.reference, ilikeTerm(term)),
      ilike(schema.journalEntries.description, ilikeTerm(term)),
      ilike(schema.journalEntries.descriptionTh, ilikeTerm(term)),
    )!,
  ];
  if (opts.entityId) conditions.push(eq(schema.journalEntries.entityId, opts.entityId));
  return db
    .select({
      id: schema.journalEntries.id,
      reference: schema.journalEntries.reference,
      description: schema.journalEntries.description,
      date: schema.journalEntries.date,
      status: schema.journalEntries.status,
    })
    .from(schema.journalEntries)
    .where(and(...conditions))
    .orderBy(desc(schema.journalEntries.date))
    .limit(limit);
}

export async function searchAccounts(
  db: Db,
  term: string,
  opts: { entityId?: string },
  limit: number,
) {
  const conditions: SQL[] = [
    isNull(schema.chartOfAccounts.deletedAt),
    or(
      ilike(schema.chartOfAccounts.code, ilikeTerm(term)),
      ilike(schema.chartOfAccounts.name, ilikeTerm(term)),
      ilike(schema.chartOfAccounts.nameTh, ilikeTerm(term)),
    )!,
  ];
  if (opts.entityId) conditions.push(eq(schema.chartOfAccounts.entityId, opts.entityId));
  return db
    .select({
      id: schema.chartOfAccounts.id,
      code: schema.chartOfAccounts.code,
      name: schema.chartOfAccounts.name,
      type: schema.chartOfAccounts.type,
    })
    .from(schema.chartOfAccounts)
    .where(and(...conditions))
    .orderBy(asc(schema.chartOfAccounts.code))
    .limit(limit);
}

export async function searchBankTransactions(
  db: Db,
  term: string,
  opts: { entityId?: string; amount?: number },
  limit: number,
) {
  const textOr = or(
    ilike(schema.bankTransactions.description, ilikeTerm(term)),
    ilike(schema.bankTransactions.reference, ilikeTerm(term)),
  );
  const conditions: SQL[] = [textOr!];
  if (opts.entityId) conditions.push(eq(schema.bankTransactions.entityId, opts.entityId));
  if (opts.amount != null) conditions.push(eq(schema.bankTransactions.amount, String(opts.amount)));
  return db
    .select({
      id: schema.bankTransactions.id,
      description: schema.bankTransactions.description,
      amount: schema.bankTransactions.amount,
      date: schema.bankTransactions.date,
      status: schema.bankTransactions.status,
      entityName: schema.entities.name,
    })
    .from(schema.bankTransactions)
    .innerJoin(schema.entities, eq(schema.bankTransactions.entityId, schema.entities.id))
    .where(and(...conditions))
    .orderBy(desc(schema.bankTransactions.date))
    .limit(limit);
}

export async function searchPayments(
  db: Db,
  term: string,
  opts: { entityId?: string; createdBy?: string; amount?: number },
  limit: number,
) {
  const textOr = or(
    ilike(schema.payments.reference, ilikeTerm(term)),
    ilike(schema.payments.method, ilikeTerm(term)),
  );
  const conditions: SQL[] = [
    isNull(schema.payments.deletedAt),
    isNull(schema.invoices.deletedAt),
    textOr!,
  ];
  if (opts.entityId) conditions.push(eq(schema.payments.entityId, opts.entityId));
  if (opts.createdBy) conditions.push(eq(schema.invoices.createdBy, opts.createdBy));
  if (opts.amount != null) conditions.push(eq(schema.payments.amount, String(opts.amount)));
  return db
    .select({
      id: schema.payments.id,
      invoiceId: schema.invoices.id,
      invoiceNo: schema.invoices.invoiceNo,
      counterparty: schema.invoices.counterparty,
      method: schema.payments.method,
      amount: schema.payments.amount,
      date: schema.payments.date,
    })
    .from(schema.payments)
    .innerJoin(schema.invoices, eq(schema.payments.invoiceId, schema.invoices.id))
    .where(and(...conditions))
    .orderBy(desc(schema.payments.date))
    .limit(limit);
}

// ── Bank accounts (read) ────────────────────────────────────────────────────

export async function findBankAccounts(
  db: Db,
  filters: { entityId?: string; includeInactive?: boolean },
) {
  const conditions: SQL[] = [isNull(schema.bankAccounts.deletedAt)];
  if (filters.entityId) conditions.push(eq(schema.bankAccounts.entityId, filters.entityId));
  if (!filters.includeInactive) conditions.push(eq(schema.bankAccounts.isActive, true));
  return db
    .select()
    .from(schema.bankAccounts)
    .where(and(...conditions))
    .orderBy(asc(schema.bankAccounts.sortOrder), asc(schema.bankAccounts.name));
}

export async function findBankAccountById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.bankAccounts)
    .where(and(eq(schema.bankAccounts.id, id), isNull(schema.bankAccounts.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ── Credit notes (read) ─────────────────────────────────────────────────────

async function loadCreditNoteLines(db: DbLike, creditNoteId: string) {
  return db
    .select()
    .from(schema.creditNoteLines)
    .where(eq(schema.creditNoteLines.creditNoteId, creditNoteId))
    .orderBy(asc(schema.creditNoteLines.sortOrder));
}

export async function findCreditNotes(
  db: Db,
  filters: { entityId?: string; type?: string; noteKind?: string; status?: string },
) {
  const conditions: SQL[] = [isNull(schema.creditNotes.deletedAt)];
  if (filters.entityId) conditions.push(eq(schema.creditNotes.entityId, filters.entityId));
  if (filters.type) conditions.push(eq(schema.creditNotes.type, filters.type));
  if (filters.noteKind) conditions.push(eq(schema.creditNotes.noteKind, filters.noteKind));
  if (filters.status) conditions.push(eq(schema.creditNotes.status, filters.status));
  const rows = await db
    .select()
    .from(schema.creditNotes)
    .where(and(...conditions))
    .orderBy(desc(schema.creditNotes.createdAt));
  return Promise.all(
    rows.map(async (row) => ({ ...row, lines: await loadCreditNoteLines(db, row.id) })),
  );
}

export async function findCreditNoteById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.creditNotes)
    .where(and(eq(schema.creditNotes.id, id), isNull(schema.creditNotes.deletedAt)))
    .limit(1);
  if (!row) return null;
  return { ...row, lines: await loadCreditNoteLines(db, row.id) };
}

// ── Purchase orders (read) ──────────────────────────────────────────────────

async function loadPoLines(db: DbLike, poId: string) {
  return db
    .select()
    .from(schema.poLines)
    .where(eq(schema.poLines.poId, poId))
    .orderBy(asc(schema.poLines.sortOrder));
}

export async function findPurchaseOrders(
  db: Db,
  filters: { entityId?: string; status?: string },
) {
  const conditions: SQL[] = [isNull(schema.purchaseOrders.deletedAt)];
  if (filters.entityId) conditions.push(eq(schema.purchaseOrders.entityId, filters.entityId));
  if (filters.status) conditions.push(eq(schema.purchaseOrders.status, filters.status));
  const rows = await db
    .select()
    .from(schema.purchaseOrders)
    .where(and(...conditions))
    .orderBy(desc(schema.purchaseOrders.createdAt));
  return Promise.all(rows.map(async (row) => ({ ...row, lines: await loadPoLines(db, row.id) })));
}

export async function findPurchaseOrderById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.purchaseOrders)
    .where(and(eq(schema.purchaseOrders.id, id), isNull(schema.purchaseOrders.deletedAt)))
    .limit(1);
  if (!row) return null;
  return { ...row, lines: await loadPoLines(db, row.id) };
}

// ── Fixed asset categories (read) ───────────────────────────────────────────

export async function findFixedAssetCategories(
  db: Db,
  entityId: string,
  includeInactive: boolean,
) {
  const conditions: SQL[] = [eq(schema.fixedAssetCategories.entityId, entityId)];
  if (!includeInactive) conditions.push(eq(schema.fixedAssetCategories.isActive, true));
  return db
    .select()
    .from(schema.fixedAssetCategories)
    .where(and(...conditions))
    .orderBy(asc(schema.fixedAssetCategories.assetClass), asc(schema.fixedAssetCategories.code));
}

export async function findFixedAssetCategoryById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.fixedAssetCategories)
    .where(eq(schema.fixedAssetCategories.id, id))
    .limit(1);
  return row ?? null;
}

// ── Quote vendor join ───────────────────────────────────────────────────────

export async function findQuoteVendor(db: DbLike, vendorId: string | null) {
  if (!vendorId) return null;
  const [row] = await db
    .select({ id: schema.vendors.id, name: schema.vendors.name, email: schema.vendors.email })
    .from(schema.vendors)
    .where(eq(schema.vendors.id, vendorId))
    .limit(1);
  return row ?? null;
}
