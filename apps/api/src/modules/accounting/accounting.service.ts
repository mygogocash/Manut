import { Prisma } from "@manut/database";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import type {
  AccountQuery,
  BankTransactionQuery,
  CreateAccountInput,
  CreateInvoiceInput,
  CreateJournalInput,
  ImportAccountsInput,
  ImportBankStatementInput,
  ImportJournalsInput,
  InvoiceQuery,
  JournalQuery,
  UpdateAccountInput,
  UpdateInvoiceInput,
  UpdateJournalInput,
} from "@/modules/accounting/accounting.validation";

/**
 * `JournalEntry` doesn't persist running totals — they're a sum of the
 * child `JournalEntryLine.debit` / `.credit` columns, which already
 * survive validation (debit-credit balance is enforced server-side at
 * create time). Compute on read so the list view doesn't have to wire
 * its own aggregate query and the frontend can stop rendering "NaN" in
 * the totals column. Stringified so the wire shape matches the rest of
 * the Decimal fields the API ships (e.g. ChartOfAccount.balance).
 */
function decorateJournalTotals<
  T extends { lines: Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }> },
>(j: T): T & { totalDebit: string; totalCredit: string } {
  const zero = new Prisma.Decimal(0);
  const totalDebit = j.lines.reduce((acc, l) => acc.plus(l.debit), zero);
  const totalCredit = j.lines.reduce((acc, l) => acc.plus(l.credit), zero);
  return {
    ...j,
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
  };
}

export class AccountingService {
  async listAccounts(query: AccountQuery) {
    return accountingRepository.findAccounts(query);
  }

  async createAccount(input: CreateAccountInput) {
    const existing = await accountingRepository.findAccountByEntityAndCode(
      input.entityId,
      input.code,
    );
    if (existing) {
      throw new ConflictException(
        `Account code "${input.code}" already exists for this entity`,
      );
    }

    return accountingRepository.createAccount(input);
  }

  async getAccountById(id: string) {
    const account = await accountingRepository.findAccountById(id);
    if (!account) throw new NotFoundException("Account not found");
    return account;
  }

  async updateAccount(id: string, input: UpdateAccountInput) {
    await this.getAccountById(id);
    return accountingRepository.updateAccount(id, input);
  }

  async deleteAccount(id: string) {
    await this.getAccountById(id);
    return accountingRepository.softDeleteAccount(id);
  }

  // Preview a Chart-of-Accounts import: dedupes the payload by code
  // and classifies each row as
  //   - "insert"    → code is new, account will be created
  //   - "update-th" → code exists but `nameTh` is empty and the xlsx
  //                   row has one, so the Thai label will be back-filled
  //   - "skip"      → code exists and either has a Thai name already or
  //                   the xlsx row doesn't supply one
  // The UI shows the row-by-row breakdown before the user commits.
  async previewAccountImport(input: ImportAccountsInput) {
    const seen = new Set<string>();
    const dedup: ImportAccountsInput["rows"] = [];
    let duplicateInPayload = 0;
    for (const r of input.rows) {
      if (seen.has(r.code)) {
        duplicateInPayload += 1;
        continue;
      }
      seen.add(r.code);
      dedup.push(r);
    }

    const existing = await accountingRepository.findAccountCodes(
      input.entityId,
      dedup.map((r) => r.code),
    );
    const existingByCode = new Map(existing.map((e) => [e.code, e]));

    const rows = dedup.map((r) => {
      const hit = existingByCode.get(r.code);
      let action: "insert" | "update-th" | "skip";
      if (!hit) {
        action = "insert";
      } else if (!hit.nameTh && r.nameTh) {
        action = "update-th";
      } else {
        action = "skip";
      }
      return {
        code: r.code,
        name: r.name,
        nameTh: r.nameTh,
        type: r.type,
        action,
      };
    });

    const inserts = rows.filter((r) => r.action === "insert").length;
    const updates = rows.filter((r) => r.action === "update-th").length;
    const skipped = rows.filter((r) => r.action === "skip").length;

    return {
      rows,
      summary: {
        total: input.rows.length,
        unique: dedup.length,
        duplicateInPayload,
        inserts,
        updates,
        skipped,
      },
    };
  }

  async commitAccountImport(input: ImportAccountsInput) {
    const preview = await this.previewAccountImport(input);
    const toInsert = preview.rows.filter((r) => r.action === "insert");
    const toUpdate = preview.rows
      .filter((r) => r.action === "update-th" && r.nameTh)
      .map((r) => ({ code: r.code, nameTh: r.nameTh! }));

    const [insertResult, updatedCount] = await Promise.all([
      accountingRepository.createAccountsBulk(input.entityId, toInsert),
      accountingRepository.backfillAccountNameTh(input.entityId, toUpdate),
    ]);

    return {
      inserted: insertResult.count,
      updated: updatedCount,
      skipped: preview.summary.skipped + preview.summary.duplicateInPayload,
      total: preview.summary.total,
    };
  }

  // Preview a journal-entry import from the GL xlsx. Classifies every
  // entry as one of:
  //   - "insert"           → reference is new + balanced + all accounts exist
  //   - "skip-duplicate"   → reference already exists for this entity
  //   - "skip-unbalanced"  → sum of debits != sum of credits (within 0.01)
  //   - "skip-missing"     → at least one line references an unknown code
  // The UI shows the row-by-row breakdown before commit.
  async previewJournalImport(input: ImportJournalsInput) {
    // De-dupe by reference inside the payload (later occurrences ignored).
    const seenRef = new Set<string>();
    const deduped: ImportJournalsInput["entries"] = [];
    let duplicateInPayload = 0;
    for (const e of input.entries) {
      if (seenRef.has(e.reference)) {
        duplicateInPayload += 1;
        continue;
      }
      seenRef.add(e.reference);
      deduped.push(e);
    }

    const allCodes = new Set<string>();
    for (const e of deduped) {
      for (const l of e.lines) allCodes.add(l.accountCode);
    }

    const [accounts, existing] = await Promise.all([
      accountingRepository.findAccountIdsByCodes(input.entityId, [...allCodes]),
      accountingRepository.findJournalReferences(
        input.entityId,
        deduped.map((e) => e.reference),
      ),
    ]);

    const accountByCode = new Map(accounts.map((a) => [a.code, a]));
    const existingByRef = new Map(existing.map((r) => [r.reference!, r]));

    const rows = deduped.map((e) => {
      const totalDebit = e.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = e.lines.reduce((s, l) => s + l.credit, 0);
      const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
      const missingCodes = e.lines
        .map((l) => l.accountCode)
        .filter((c) => !accountByCode.has(c));
      const existingRow = existingByRef.get(e.reference);

      // Reference is bilingual: a row that already exists can still
      // be updated when the import language fills in the *other*
      // column. "skip-duplicate" only fires when the chosen language
      // column is already populated.
      let action:
        | "insert"
        | "update"
        | "skip-duplicate"
        | "skip-unbalanced"
        | "skip-missing";
      if (existingRow) {
        const alreadyHasTargetLang =
          input.language === "th"
            ? !!existingRow.descriptionTh
            : !!existingRow.description;
        action = alreadyHasTargetLang ? "skip-duplicate" : "update";
      } else if (missingCodes.length > 0) {
        action = "skip-missing";
      } else if (!balanced) {
        action = "skip-unbalanced";
      } else {
        action = "insert";
      }

      return {
        reference: e.reference,
        date: e.date,
        description: e.description,
        lineCount: e.lines.length,
        totalDebit,
        totalCredit,
        missingCodes,
        action,
      };
    });

    const summary = {
      total: input.entries.length,
      unique: deduped.length,
      duplicateInPayload,
      inserts: rows.filter((r) => r.action === "insert").length,
      updates: rows.filter((r) => r.action === "update").length,
      skipDuplicates: rows.filter((r) => r.action === "skip-duplicate").length,
      skipUnbalanced: rows.filter((r) => r.action === "skip-unbalanced").length,
      skipMissing: rows.filter((r) => r.action === "skip-missing").length,
    };

    return { rows, summary };
  }

  async commitJournalImport(userId: string, input: ImportJournalsInput) {
    // Re-run preview to filter to insertable rows. Single source of truth
    // for what counts as a clean insert.
    const seenRef = new Set<string>();
    const deduped: ImportJournalsInput["entries"] = [];
    for (const e of input.entries) {
      if (seenRef.has(e.reference)) continue;
      seenRef.add(e.reference);
      deduped.push(e);
    }

    const allCodes = new Set<string>();
    for (const e of deduped) {
      for (const l of e.lines) allCodes.add(l.accountCode);
    }

    const [accounts, existing] = await Promise.all([
      accountingRepository.findAccountIdsByCodes(input.entityId, [...allCodes]),
      accountingRepository.findJournalReferences(
        input.entityId,
        deduped.map((e) => e.reference),
      ),
    ]);

    const accountIdByCode = new Map(accounts.map((a) => [a.code, a.id]));
    const existingByRef = new Map(existing.map((r) => [r.reference!, r]));

    type Actionable = (typeof deduped)[number] & {
      existingId: string | null;
    };
    const actionable: Actionable[] = [];
    for (const e of deduped) {
      const existingRow = existingByRef.get(e.reference);
      if (existingRow) {
        const alreadyHasTargetLang =
          input.language === "th"
            ? !!existingRow.descriptionTh
            : !!existingRow.description;
        if (alreadyHasTargetLang) continue; // skip-duplicate
        actionable.push({ ...e, existingId: existingRow.id });
        continue;
      }
      if (e.lines.some((l) => !accountIdByCode.has(l.accountCode))) continue;
      const td = e.lines.reduce((s, l) => s + l.debit, 0);
      const tc = e.lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(td - tc) >= 0.01) continue;
      actionable.push({ ...e, existingId: null });
    }

    if (actionable.length === 0) {
      return {
        inserted: 0,
        updated: 0,
        skipped: input.entries.length,
        total: input.entries.length,
      };
    }

    // Allocate entry numbers serially based on current count for the
    // entries that are genuinely new — existing rows reuse their stored
    // `entryNo` (the update path doesn't touch it). Pre-existing rows
    // for this entity are counted once; the importer rides on top.
    const startSeq = await accountingRepository.countJournalsForEntity(
      input.entityId,
    );
    let insertOffset = 0;
    const stamped = actionable.map((e) => {
      const entryNo = e.existingId
        ? ""
        : `JE-${String(startSeq + ++insertOffset).padStart(6, "0")}`;
      return { ...e, entryNo, accountIdByCode };
    });

    const { inserted, updated } = await accountingRepository.importJournals(
      input.entityId,
      userId,
      input.status,
      input.language,
      stamped,
    );

    return {
      inserted,
      updated,
      skipped: input.entries.length - inserted - updated,
      total: input.entries.length,
    };
  }

  async listJournals(query: JournalQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await accountingRepository.findJournals(
      filters,
      page,
      limit,
    );

    let decorated = data.map((j) => decorateJournalTotals(j));
    // totalDebit / totalCredit are summed from the child lines after
    // Prisma returns the page, so we can't ORDER BY them at the SQL
    // layer. Sort the in-memory page when the caller asks for them.
    if (filters.sortBy === "totalDebit" || filters.sortBy === "totalCredit") {
      const key = filters.sortBy;
      const dir = filters.sortOrder === "asc" ? 1 : -1;
      decorated = [...decorated].sort(
        (a, b) =>
          dir *
          (Number((a as Record<string, unknown>)[key] ?? 0) -
            Number((b as Record<string, unknown>)[key] ?? 0)),
      );
    }

    return {
      data: decorated,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getJournalById(id: string) {
    const journal = await accountingRepository.findJournalById(id);
    if (!journal) throw new NotFoundException("Journal entry not found");
    return decorateJournalTotals(journal);
  }

  async createJournal(userId: string, input: CreateJournalInput) {
    const created = await accountingRepository.createJournal({
      entityId: input.entityId,
      date: input.date,
      description: input.description,
      reference: input.reference,
      createdBy: userId,
      lines: input.lines,
    });
    return decorateJournalTotals(created);
  }

  async updateJournal(journalId: string, input: UpdateJournalInput) {
    const journal = await accountingRepository.findJournalById(journalId);
    if (!journal) throw new NotFoundException("Journal entry not found");
    if (journal.status !== "draft") {
      throw new BadRequestException(
        `Cannot update a journal with status "${journal.status}"`,
      );
    }
    const updated = await accountingRepository.updateJournal(journalId, input);
    return decorateJournalTotals(updated);
  }

  async deleteJournal(journalId: string) {
    const journal = await accountingRepository.findJournalById(journalId);
    if (!journal) throw new NotFoundException("Journal entry not found");
    if (journal.status !== "draft") {
      throw new BadRequestException(
        `Cannot delete a journal with status "${journal.status}"`,
      );
    }
    return accountingRepository.softDeleteJournal(journalId);
  }

  /**
   * Admin-only bulk wipe. Unlike `deleteJournal`, this does not honour
   * the draft-only guard — accounting admins use it to roll back bad
   * imports or clean staging environments where posted journals exist.
   * Caller is responsible for the audit log entry.
   */
  async bulkDeleteJournals(opts: { ids?: string[]; all?: boolean }) {
    if (opts.all === true) {
      const result = await accountingRepository.deleteAllJournals();
      return { deletedCount: result.count, mode: "all" as const };
    }
    const ids = opts.ids ?? [];
    if (ids.length === 0) {
      throw new BadRequestException(
        "Provide `ids` to delete specific journals or set `all: true`",
      );
    }
    const result = await accountingRepository.bulkDeleteJournals(ids);
    return { deletedCount: result.count, mode: "ids" as const };
  }

  async approveJournal(journalId: string, approverId: string) {
    const journal = await accountingRepository.findJournalById(journalId);
    if (!journal) throw new NotFoundException("Journal entry not found");
    if (journal.status !== "draft") {
      throw new BadRequestException(
        `Cannot approve a journal with status "${journal.status}"`,
      );
    }

    const approved = await accountingRepository.approveJournal(
      journalId,
      approverId,
    );
    return decorateJournalTotals(approved);
  }

  async postJournal(journalId: string) {
    const journal = await accountingRepository.findJournalById(journalId);
    if (!journal) throw new NotFoundException("Journal entry not found");
    if (journal.status !== "approved") {
      throw new BadRequestException(
        `Cannot post a journal with status "${journal.status}". It must be approved first.`,
      );
    }

    const lines = journal.lines.map((l) => ({
      accountId: l.accountId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));

    const posted = await accountingRepository.postJournal(journalId, lines);
    return decorateJournalTotals(posted);
  }

  async listInvoices(query: InvoiceQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await accountingRepository.findInvoices(
      filters,
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createInvoice(input: CreateInvoiceInput) {
    const existing = await accountingRepository.findInvoiceByEntityAndNo(
      input.entityId,
      input.invoiceNo,
    );
    if (existing) {
      throw new ConflictException(
        `Invoice number "${input.invoiceNo}" already exists for this entity`,
      );
    }

    return accountingRepository.createInvoice(input);
  }

  async getInvoiceById(id: string) {
    const invoice = await accountingRepository.findInvoiceById(id);
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  async updateInvoice(id: string, input: UpdateInvoiceInput) {
    const invoice = await accountingRepository.findInvoiceById(id);
    if (!invoice) throw new NotFoundException("Invoice not found");

    return accountingRepository.updateInvoice(id, {
      ...(input.invoiceNo !== undefined && { invoiceNo: input.invoiceNo }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.counterparty !== undefined && {
        counterparty: input.counterparty,
      }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.issueDate !== undefined && {
        issueDate: new Date(input.issueDate),
      }),
      ...(input.dueDate !== undefined && { dueDate: new Date(input.dueDate) }),
      ...(input.linkedJeId !== undefined && { linkedJeId: input.linkedJeId }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });
  }

  async deleteInvoice(id: string) {
    const invoice = await accountingRepository.findInvoiceById(id);
    if (!invoice) throw new NotFoundException("Invoice not found");
    return accountingRepository.softDeleteInvoice(id);
  }

  async listBankTransactions(query: BankTransactionQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await accountingRepository.findBankTransactions(
      filters,
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async importBankStatement(input: ImportBankStatementInput) {
    const result = await accountingRepository.importBankTransactions(
      input.entityId,
      input.transactions,
    );

    return { imported: result.count };
  }
}

export const accountingService = new AccountingService();
