import { z } from "zod";

import { isValidOptionalYmdRange } from "@/common/optional-ymd-range";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const ACCOUNT_SORT_FIELDS = ["code", "name", "type", "balance"] as const;
export type AccountSortField = (typeof ACCOUNT_SORT_FIELDS)[number];

export const accountQuerySchema = z.object({
  entityId: z.string().optional(),
  type: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  parentId: z.string().optional(),
  sortBy: z.enum(ACCOUNT_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const createAccountSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  nameTh: z.string().max(200).optional(),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  parentId: z.string().optional(),
});

export const JOURNAL_SORT_FIELDS = [
  "reference",
  "date",
  "entity",
  "description",
  "totalDebit",
  "totalCredit",
  "status",
] as const;
export type JournalSortField = (typeof JOURNAL_SORT_FIELDS)[number];

export const journalQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    entityId: z.string().optional(),
    status: z.enum(["draft", "approved", "posted"]).optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    // Filter journals by which description column was populated at
    // import time. "en" → `description` is non-null, "th" → `descriptionTh`
    // is non-null. Omitted/"auto" returns every row regardless of which
    // language variant exists.
    descriptionLang: z.enum(["en", "th"]).optional(),
    sortBy: z.enum(JOURNAL_SORT_FIELDS).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((q) => isValidOptionalYmdRange(q.startDate, q.endDate), {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

const journalLineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  memo: z.string().max(500).optional(),
});

export const createJournalSchema = z
  .object({
    entityId: z.string().min(1, "Entity is required"),
    date: dateString,
    description: z.string().max(500).optional(),
    reference: z.string().max(100).optional(),
    lines: z.array(journalLineSchema).min(2, "At least 2 lines required"),
  })
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    { message: "Total debits must equal total credits", path: ["lines"] },
  )
  .refine((data) => data.lines.every((l) => l.debit > 0 || l.credit > 0), {
    message: "Each line must have either a debit or credit amount",
    path: ["lines"],
  });

export const INVOICE_SORT_FIELDS = [
  "invoiceNo",
  "type",
  "counterparty",
  "amount",
  "issueDate",
  "dueDate",
  "status",
] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entityId: z.string().optional(),
  type: z.enum(["receivable", "payable"]).optional(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  sortBy: z.enum(INVOICE_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const invoiceFieldsSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  invoiceNo: z.string().min(1, "Invoice number is required"),
  type: z.enum(["receivable", "payable"]),
  counterparty: z.string().min(1, "Counterparty is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().min(1).max(10),
  issueDate: dateString,
  dueDate: dateString,
  linkedJeId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const createInvoiceSchema = invoiceFieldsSchema.refine(
  (data) => data.dueDate >= data.issueDate,
  {
    message: "Due date must not be before issue date",
    path: ["dueDate"],
  },
);

export const BANK_TX_SORT_FIELDS = [
  "date",
  "description",
  "entity",
  "amount",
  "status",
] as const;
export type BankTxSortField = (typeof BANK_TX_SORT_FIELDS)[number];

export const bankTransactionQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    entityId: z.string().optional(),
    status: z.enum(["unmatched", "matched", "reconciled"]).optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    sortBy: z.enum(BANK_TX_SORT_FIELDS).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((q) => isValidOptionalYmdRange(q.startDate, q.endDate), {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

const bankTransactionRowSchema = z.object({
  date: dateString,
  description: z.string().min(1),
  amount: z.coerce.number(),
  balance: z.coerce.number().optional(),
  reference: z.string().optional(),
  bankAccount: z.string().optional(),
});

export const importBankStatementSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  transactions: z
    .array(bankTransactionRowSchema)
    .min(1, "At least 1 transaction required"),
});

export const updateAccountSchema = createAccountSchema.partial().omit({
  entityId: true,
});

// Journal entry import — frontend parses the accounting-system GL xlsx
// locally, groups rows by Document No (voucher), and POSTs canonical
// journal-entry payloads. Each entry must balance (sum of debits == sum
// of credits) and reference accounts by their `code` so the backend can
// resolve them to ChartOfAccount.id per entity.
const journalImportLineSchema = z.object({
  accountCode: z.string().min(1).max(50),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  memo: z.string().max(500).optional(),
});

const journalImportEntrySchema = z.object({
  reference: z.string().min(1).max(100),
  date: dateString,
  description: z.string().max(500).optional(),
  lines: z.array(journalImportLineSchema).min(1),
});

export const importJournalsSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  status: z.enum(["draft", "approved", "posted"]).default("posted"),
  // GL export is single-language per file. The importer fills
  // `description` for "en" and `descriptionTh` for "th"; when a
  // reference already exists, only the chosen language column is
  // overwritten. Defaults to English to preserve the previous import
  // behaviour for callers that don't pass the field yet.
  language: z.enum(["en", "th"]).default("en"),
  entries: z
    .array(journalImportEntrySchema)
    .min(1, "At least 1 entry required")
    .max(5000),
});

const accountImportRowSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  nameTh: z.string().max(200).optional(),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
});

export const importAccountsSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  rows: z
    .array(accountImportRowSchema)
    .min(1, "At least 1 row required")
    .max(2000),
});

export const updateJournalSchema = z
  .object({
    date: dateString.optional(),
    description: z.string().max(500).optional(),
    reference: z.string().max(100).optional(),
    lines: z
      .array(journalLineSchema)
      .min(2, "At least 2 lines required")
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.lines) return true;
      const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    { message: "Total debits must equal total credits", path: ["lines"] },
  )
  .refine(
    (data) => {
      if (!data.lines) return true;
      return data.lines.every((l) => l.debit > 0 || l.credit > 0);
    },
    {
      message: "Each line must have either a debit or credit amount",
      path: ["lines"],
    },
  );

export const updateInvoiceSchema = invoiceFieldsSchema
  .partial()
  .omit({ entityId: true })
  .refine((data) => isValidOptionalYmdRange(data.issueDate, data.dueDate), {
    message: "Due date must not be before issue date",
    path: ["dueDate"],
  });

export const bulkDeleteJournalsSchema = z
  .object({
    all: z.boolean().optional(),
    ids: z.array(z.string().uuid()).max(1000).optional(),
  })
  .refine((v) => v.all === true || (v.ids && v.ids.length > 0), {
    message: "Provide `ids` to delete specific journals or set `all: true`",
  });

export type BulkDeleteJournalsInput = z.infer<typeof bulkDeleteJournalsSchema>;

export type AccountQuery = z.infer<typeof accountQuerySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type JournalQuery = z.infer<typeof journalQuerySchema>;
export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type BankTransactionQuery = z.infer<typeof bankTransactionQuerySchema>;
export type ImportBankStatementInput = z.infer<
  typeof importBankStatementSchema
>;
export type ImportAccountsInput = z.infer<typeof importAccountsSchema>;
export type ImportAccountRow = z.infer<typeof accountImportRowSchema>;
export type ImportJournalsInput = z.infer<typeof importJournalsSchema>;
export type ImportJournalEntry = z.infer<typeof journalImportEntrySchema>;
export type ImportJournalLine = z.infer<typeof journalImportLineSchema>;
