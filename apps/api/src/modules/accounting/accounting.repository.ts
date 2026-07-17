import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { softDeleteUpdate } from "@/infrastructure/soft-delete";
import type {
  CreateAccountInput,
  CreateInvoiceInput,
  CreateJournalInput,
  ImportAccountRow,
  ImportBankStatementInput,
  ImportJournalEntry,
  UpdateAccountInput,
  UpdateJournalInput,
} from "@/modules/accounting/accounting.validation";

const journalIncludes = {
  entity: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true, email: true } },
  approver: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { debit: "desc" as const },
  },
} satisfies Prisma.JournalEntryInclude;

const invoiceIncludes = {
  entity: { select: { id: true, name: true } },
} satisfies Prisma.InvoiceInclude;

export class AccountingRepository {
  async findAccounts(filters: {
    entityId?: string;
    type?: string;
    isActive?: boolean;
    parentId?: string;
    sortBy?: "code" | "name" | "type" | "balance";
    sortOrder?: "asc" | "desc";
  }) {
    const where: Prisma.ChartOfAccountWhereInput = { deletedAt: null };
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.type) where.type = filters.type;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.parentId) where.parentId = filters.parentId;

    const dir = filters.sortOrder ?? "asc";
    const orderBy: Prisma.ChartOfAccountOrderByWithRelationInput =
      filters.sortBy === "name"
        ? { name: dir }
        : filters.sortBy === "type"
          ? { type: dir }
          : filters.sortBy === "balance"
            ? { balance: dir }
            : { code: filters.sortBy === "code" ? dir : "asc" };

    return prisma.chartOfAccount.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
      },
      orderBy,
    });
  }

  async findAccountByEntityAndCode(entityId: string, code: string) {
    return prisma.chartOfAccount.findUnique({
      where: { entityId_code: { entityId, code }, deletedAt: null },
    });
  }

  async findAccountById(id: string) {
    return prisma.chartOfAccount.findUnique({
      where: { id, deletedAt: null },
      include: {
        entity: { select: { id: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createAccount(data: CreateAccountInput) {
    return prisma.chartOfAccount.create({
      data: {
        entityId: data.entityId,
        code: data.code,
        name: data.name,
        nameTh: data.nameTh ?? null,
        type: data.type,
        parentId: data.parentId,
      },
      include: {
        entity: { select: { id: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateAccount(id: string, data: UpdateAccountInput) {
    return prisma.chartOfAccount.update({
      where: { id },
      data,
      include: {
        entity: { select: { id: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async softDeleteAccount(id: string) {
    return prisma.chartOfAccount.update({
      where: { id },
      data: softDeleteUpdate(),
      include: {
        entity: { select: { id: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async restoreAccount(id: string) {
    return prisma.chartOfAccount.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        entity: { select: { id: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async permanentDeleteAccount(id: string) {
    return prisma.chartOfAccount.delete({ where: { id } });
  }

  async findAccountCodes(entityId: string, codes: string[]) {
    if (codes.length === 0) return [];
    return prisma.chartOfAccount.findMany({
      where: { entityId, code: { in: codes } },
      select: { code: true, nameTh: true },
    });
  }

  async createAccountsBulk(entityId: string, rows: ImportAccountRow[]) {
    if (rows.length === 0) return { count: 0 };
    return prisma.chartOfAccount.createMany({
      data: rows.map((r) => ({
        entityId,
        code: r.code,
        name: r.name,
        nameTh: r.nameTh ?? null,
        type: r.type,
      })),
      skipDuplicates: true,
    });
  }

  // Back-fills the Thai-language name on accounts that already exist
  // but were imported before nameTh was a column. Only touches rows
  // currently NULL on `name_th` so a manually-set Thai label is never
  // clobbered. Returns the number of rows actually updated.
  async backfillAccountNameTh(
    entityId: string,
    rows: Array<{ code: string; nameTh: string }>,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const results = await prisma.$transaction(
      rows.map((r) =>
        prisma.chartOfAccount.updateMany({
          where: { entityId, code: r.code, nameTh: null },
          data: { nameTh: r.nameTh },
        }),
      ),
    );
    return results.reduce((sum, res) => sum + res.count, 0);
  }

  async findJournals(
    filters: {
      entityId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      descriptionLang?: "en" | "th";
      sortBy?:
        | "reference"
        | "date"
        | "entity"
        | "description"
        | "totalDebit"
        | "totalCredit"
        | "status";
      sortOrder?: "asc" | "desc";
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.JournalEntryWhereInput = { deletedAt: null };
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }
    // Language filter mirrors the import column the row was loaded into.
    // We treat blank strings as "missing" so legacy rows that stored
    // `""` instead of NULL don't leak through the wrong tab.
    if (filters.descriptionLang === "en") {
      where.description = { not: null, notIn: [""] };
    } else if (filters.descriptionLang === "th") {
      where.descriptionTh = { not: null, notIn: [""] };
    }

    // totalDebit / totalCredit are derived at response time from the
    // child lines, so we can't ORDER BY them in Prisma. Fall back to
    // `date` for those keys and let the service sort by total client-side.
    const dir = filters.sortOrder ?? "desc";
    const orderBy: Prisma.JournalEntryOrderByWithRelationInput =
      filters.sortBy === "reference"
        ? { reference: dir }
        : filters.sortBy === "date"
          ? { date: dir }
          : filters.sortBy === "entity"
            ? { entity: { name: dir } }
            : filters.sortBy === "description"
              ? { description: dir }
              : filters.sortBy === "status"
                ? { status: dir }
                : { createdAt: "desc" };

    const [data, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: journalIncludes,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return { data, total };
  }

  async findJournalById(id: string) {
    return prisma.journalEntry.findUnique({
      where: { id, deletedAt: null },
      include: journalIncludes,
    });
  }

  async generateEntryNo(entityId: string): Promise<string> {
    const count = await prisma.journalEntry.count({ where: { entityId } });
    return `JE-${String(count + 1).padStart(6, "0")}`;
  }

  async countJournalsForEntity(entityId: string): Promise<number> {
    return prisma.journalEntry.count({ where: { entityId } });
  }

  async createJournal(data: CreateJournalInput & { createdBy: string }) {
    const entryNo = await this.generateEntryNo(data.entityId);

    return prisma.journalEntry.create({
      data: {
        entityId: data.entityId,
        entryNo,
        date: new Date(data.date),
        description: data.description,
        reference: data.reference,
        createdBy: data.createdBy,
        lines: {
          createMany: {
            data: data.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              memo: l.memo,
            })),
          },
        },
      },
      include: journalIncludes,
    });
  }

  async approveJournal(id: string, approvedBy: string) {
    return prisma.journalEntry.update({
      where: { id },
      data: { status: "approved", approvedBy, approvedAt: new Date() },
      include: journalIncludes,
    });
  }

  async postJournal(
    id: string,
    lines: Array<{ accountId: string; debit: number; credit: number }>,
  ) {
    return prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const delta = line.debit - line.credit;
        await tx.chartOfAccount.update({
          where: { id: line.accountId },
          data: { balance: { increment: delta } },
        });
      }

      return tx.journalEntry.update({
        where: { id },
        data: { status: "posted", postedAt: new Date() },
        include: journalIncludes,
      });
    });
  }

  async updateJournal(id: string, data: UpdateJournalInput) {
    return prisma.$transaction(async (tx) => {
      if (data.lines) {
        await tx.journalEntryLine.deleteMany({ where: { entryId: id } });
        await tx.journalEntryLine.createMany({
          data: data.lines.map((l) => ({
            entryId: id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            memo: l.memo,
          })),
        });
      }

      return tx.journalEntry.update({
        where: { id },
        data: {
          ...(data.date !== undefined && { date: new Date(data.date) }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.reference !== undefined && { reference: data.reference }),
        },
        include: journalIncludes,
      });
    });
  }

  async softDeleteJournal(id: string) {
    return prisma.journalEntry.update({
      where: { id },
      data: softDeleteUpdate(),
      include: journalIncludes,
    });
  }

  async restoreJournal(id: string) {
    return prisma.journalEntry.update({
      where: { id },
      data: { deletedAt: null },
      include: journalIncludes,
    });
  }

  async permanentDeleteJournal(id: string) {
    return prisma.journalEntry.delete({ where: { id } });
  }

  async bulkSoftDeleteJournals(ids: string[]) {
    if (ids.length === 0) return { count: 0 };
    return prisma.journalEntry.updateMany({
      where: { id: { in: ids } },
      data: softDeleteUpdate(),
    });
  }

  async bulkDeleteJournals(ids: string[]) {
    if (ids.length === 0) return { count: 0 };
    // Lines cascade via the FK; deleting parent rows removes the children.
    return prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteAllJournals() {
    return prisma.journalEntry.deleteMany({});
  }

  // Look up account ids by entity + code for a batch of codes. Used by
  // the journal-import preview to resolve `accountCode` strings to
  // ChartOfAccount.id before insertion.
  async findAccountIdsByCodes(entityId: string, codes: string[]) {
    if (codes.length === 0) return [];
    return prisma.chartOfAccount.findMany({
      where: { entityId, code: { in: codes }, deletedAt: null },
      select: { id: true, code: true, name: true, nameTh: true },
    });
  }

  // Find existing journal entries by (entity, reference). The accounting-
  // system Document No (e.g. PV2026010023) maps to `reference`, so this
  // is the natural duplicate-check key for re-imports.
  async findJournalReferences(entityId: string, references: string[]) {
    if (references.length === 0) return [];
    return prisma.journalEntry.findMany({
      where: { entityId, reference: { in: references }, deletedAt: null },
      select: {
        id: true,
        reference: true,
        description: true,
        descriptionTh: true,
      },
    });
  }

  // Bulk-imports historical journal entries from the accounting-system
  // GL export. Each entry is either inserted (fresh reference) or
  // updated (reference already present — language column is overwritten,
  // lines are left untouched). Unlike `postJournal`, account balances
  // are NOT mutated — this importer is for historical records; the
  // canonical opening balance comes from the Chart-of-Accounts import.
  async importJournals(
    entityId: string,
    createdBy: string,
    status: "draft" | "approved" | "posted",
    language: "en" | "th",
    entries: Array<
      ImportJournalEntry & {
        entryNo: string;
        accountIdByCode: Map<string, string>;
        existingId: string | null;
      }
    >,
  ) {
    if (entries.length === 0) return { inserted: 0, updated: 0 };
    const now = new Date();
    const approvedAt = status === "draft" ? null : now;
    const postedAt = status === "posted" ? now : null;
    const approvedBy = status === "draft" ? null : createdBy;

    let inserted = 0;
    let updated = 0;
    const chunkSize = 50;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const ops = chunk.map((entry) => {
        const text = entry.description ?? null;
        const descriptionPatch =
          language === "th" ? { descriptionTh: text } : { description: text };
        if (entry.existingId) {
          // Reference already imported in the other language — patch
          // only the chosen language column. Don't touch lines /
          // status / created* so re-running an import stays idempotent.
          return prisma.journalEntry.update({
            where: { id: entry.existingId },
            data: descriptionPatch,
          });
        }
        return prisma.journalEntry.create({
          data: {
            entityId,
            entryNo: entry.entryNo,
            date: new Date(entry.date),
            description: language === "en" ? text : null,
            descriptionTh: language === "th" ? text : null,
            reference: entry.reference,
            status,
            createdBy,
            approvedBy,
            approvedAt,
            postedAt,
            lines: {
              createMany: {
                data: entry.lines.map((l) => ({
                  accountId: entry.accountIdByCode.get(l.accountCode)!,
                  debit: l.debit,
                  credit: l.credit,
                  memo: l.memo ?? null,
                })),
              },
            },
          },
        });
      });
      await prisma.$transaction(ops);
      inserted += chunk.filter((e) => !e.existingId).length;
      updated += chunk.filter((e) => e.existingId).length;
    }
    return { inserted, updated };
  }

  async findInvoices(
    filters: {
      entityId?: string;
      type?: string;
      status?: string;
      sortBy?:
        | "invoiceNo"
        | "type"
        | "counterparty"
        | "amount"
        | "issueDate"
        | "dueDate"
        | "status";
      sortOrder?: "asc" | "desc";
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.InvoiceWhereInput = { deletedAt: null };
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const dir = filters.sortOrder ?? "desc";
    const orderBy: Prisma.InvoiceOrderByWithRelationInput =
      filters.sortBy === "invoiceNo"
        ? { invoiceNo: dir }
        : filters.sortBy === "type"
          ? { type: dir }
          : filters.sortBy === "counterparty"
            ? { counterparty: dir }
            : filters.sortBy === "amount"
              ? { amount: dir }
              : filters.sortBy === "issueDate"
                ? { issueDate: dir }
                : filters.sortBy === "dueDate"
                  ? { dueDate: dir }
                  : filters.sortBy === "status"
                    ? { status: dir }
                    : { createdAt: "desc" };

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: invoiceIncludes,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { data, total };
  }

  async findInvoiceByEntityAndNo(entityId: string, invoiceNo: string) {
    return prisma.invoice.findUnique({
      where: { entityId_invoiceNo: { entityId, invoiceNo }, deletedAt: null },
    });
  }

  async createInvoice(data: CreateInvoiceInput) {
    return prisma.invoice.create({
      data: {
        entityId: data.entityId,
        invoiceNo: data.invoiceNo,
        type: data.type,
        counterparty: data.counterparty,
        amount: data.amount,
        currency: data.currency,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        linkedJeId: data.linkedJeId,
        notes: data.notes,
      },
      include: invoiceIncludes,
    });
  }

  async findInvoiceById(id: string) {
    return prisma.invoice.findUnique({
      where: { id, deletedAt: null },
      include: invoiceIncludes,
    });
  }

  async updateInvoice(id: string, data: Prisma.InvoiceUncheckedUpdateInput) {
    return prisma.invoice.update({
      where: { id },
      data,
      include: invoiceIncludes,
    });
  }

  async softDeleteInvoice(id: string) {
    return prisma.invoice.update({
      where: { id },
      data: softDeleteUpdate(),
      include: invoiceIncludes,
    });
  }

  async restoreInvoice(id: string) {
    return prisma.invoice.update({
      where: { id },
      data: { deletedAt: null },
      include: invoiceIncludes,
    });
  }

  async permanentDeleteInvoice(id: string) {
    return prisma.invoice.delete({ where: { id } });
  }

  async findBankTransactions(
    filters: {
      entityId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: "date" | "description" | "entity" | "amount" | "status";
      sortOrder?: "asc" | "desc";
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.BankTransactionWhereInput = {};
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const dir = filters.sortOrder ?? "desc";
    const orderBy: Prisma.BankTransactionOrderByWithRelationInput =
      filters.sortBy === "description"
        ? { description: dir }
        : filters.sortBy === "entity"
          ? { entity: { name: dir } }
          : filters.sortBy === "amount"
            ? { amount: dir }
            : filters.sortBy === "status"
              ? { status: dir }
              : { date: dir };

    const [data, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        include: {
          entity: { select: { id: true, name: true } },
          suggested: { select: { id: true, code: true, name: true } },
          mapped: { select: { id: true, code: true, name: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    return { data, total };
  }

  async importBankTransactions(
    entityId: string,
    rows: ImportBankStatementInput["transactions"],
  ) {
    return prisma.bankTransaction.createMany({
      data: rows.map((row) => ({
        entityId,
        date: new Date(row.date),
        description: row.description,
        amount: row.amount,
        balance: row.balance,
        reference: row.reference,
        bankAccount: row.bankAccount,
      })),
    });
  }
}

export const accountingRepository = new AccountingRepository();
