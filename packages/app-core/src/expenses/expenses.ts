import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const expenseReportStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "rejected",
  "payroll_processed",
  "reimbursed",
]);

export const expenseReportCategorySchema = z.enum([
  "general",
  "business_or_bd",
  "allowance",
  "office",
]);

export const expensePeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM");

const expenseEmployeeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.unknown().optional(),
    department: z.unknown().optional(),
  })
  .passthrough()
  .transform((employee) => ({
    id: employee.id,
    name: employee.name,
  }));

const expenseEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

// List/detail receipts strip notes, approver emails, line items,
// canApprove, and employee email/department.
const expenseReportApiSchema = z
  .object({
    id: z.string().min(1),
    period: expensePeriodSchema,
    title: z.string().min(1),
    category: expenseReportCategorySchema,
    status: expenseReportStatusSchema,
    submittedAt: nullableText,
    approvedAt: nullableText,
    rejectReason: nullableText,
    reimbursedAt: nullableText,
    totalAmount: z.number().finite(),
    totalCurrency: z.string().min(1),
    converted: z.boolean(),
    missingRates: z.array(z.string()),
    approvedTotal: z.number().finite().nullable(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    employee: expenseEmployeeSchema,
    entity: expenseEntitySchema,
    _count: z.object({ expenses: z.number().int().nonnegative() }),
  })
  .passthrough();

export const expenseReportSchema = expenseReportApiSchema.transform(
  (report) => ({
    id: report.id,
    period: report.period,
    title: report.title,
    category: report.category,
    status: report.status,
    submittedAt: report.submittedAt,
    approvedAt: report.approvedAt,
    rejectReason: report.rejectReason,
    reimbursedAt: report.reimbursedAt,
    totalAmount: report.totalAmount,
    totalCurrency: report.totalCurrency,
    converted: report.converted,
    missingRates: report.missingRates,
    approvedTotal: report.approvedTotal,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    employee: report.employee,
    entity: report.entity,
    _count: report._count,
  }),
);

const expenseReportDetailSchema = expenseReportApiSchema.transform(
  (report) => ({
    id: report.id,
    period: report.period,
    title: report.title,
    category: report.category,
    status: report.status,
    submittedAt: report.submittedAt,
    approvedAt: report.approvedAt,
    rejectReason: report.rejectReason,
    reimbursedAt: report.reimbursedAt,
    totalAmount: report.totalAmount,
    totalCurrency: report.totalCurrency,
    converted: report.converted,
    missingRates: report.missingRates,
    approvedTotal: report.approvedTotal,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    employee: report.employee,
    entity: report.entity,
    lineCount: report._count.expenses,
  }),
);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const expenseReportsResponseSchema = z
  .object({
    data: z.array(expenseReportSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const expenseReportDetailResponseSchema = z
  .object({ data: expenseReportDetailSchema })
  .strict();

export const expenseReportListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    employeeId: z.string().uuid().optional(),
    status: expenseReportStatusSchema.optional(),
    period: expensePeriodSchema.optional(),
    pendingForMe: z.boolean().optional(),
  })
  .strict();

export type ExpenseReportStatus = z.infer<typeof expenseReportStatusSchema>;
export type ExpenseReportCategory = z.infer<typeof expenseReportCategorySchema>;
export type ExpenseReport = z.infer<typeof expenseReportSchema>;
export type ExpenseReportDetail = z.infer<typeof expenseReportDetailSchema>;
export type ExpenseReportListParams = z.input<
  typeof expenseReportListParamsSchema
>;
export type ExpenseReportList = z.infer<typeof expenseReportsResponseSchema>;

export const EXPENSE_REPORTS_QUERY_ROOT = ["expenses", "reports"] as const;
export const EXPENSE_REPORT_DETAIL_QUERY_ROOT = [
  "expenses",
  "report",
] as const;

export function expenseReportsQueryKey(params: ExpenseReportListParams) {
  return [
    ...EXPENSE_REPORTS_QUERY_ROOT,
    expenseReportListParamsSchema.parse(params),
  ] as const;
}

export function expenseReportDetailQueryKey(reportId: string) {
  return [...EXPENSE_REPORT_DETAIL_QUERY_ROOT, reportId] as const;
}

function encodeExpenseReportQuery(
  params: z.output<typeof expenseReportListParamsSchema>,
): string {
  const entries: Array<[string, string | number | boolean | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["employeeId", params.employeeId],
    ["status", params.status],
    ["period", params.period],
    ["pendingForMe", params.pendingForMe],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listExpenseReports(
  client: ApiClient,
  params: ExpenseReportListParams = {},
  signal?: RequestAbortSignal,
): Promise<ExpenseReportList> {
  const query = encodeExpenseReportQuery(
    expenseReportListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/expenses/reports?${query}`,
    signal ? { signal } : undefined,
  );
  return expenseReportsResponseSchema.parse(response);
}

export async function getExpenseReport(
  client: ApiClient,
  reportId: string,
  signal?: RequestAbortSignal,
): Promise<ExpenseReportDetail> {
  const id = z.string().min(1).parse(reportId);
  const response = await client.get<unknown>(
    `/expenses/reports/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return expenseReportDetailResponseSchema.parse(response).data;
}

const trimmedRequired = z.string().trim().min(1);

export const createExpenseReportInputSchema = z
  .object({
    entityId: trimmedRequired,
    period: expensePeriodSchema,
    title: trimmedRequired.max(200),
    category: expenseReportCategorySchema
      .exclude(["allowance"])
      .default("general"),
    notes: z
      .string()
      .trim()
      .max(2000)
      .transform((value) => value || undefined)
      .optional(),
  })
  .strict();

export type CreateExpenseReportInput = z.input<
  typeof createExpenseReportInputSchema
>;

const createdExpenseReportResponseSchema = z
  .object({ data: expenseReportSchema })
  .strict();

export async function createExpenseReport(
  client: ApiClient,
  input: CreateExpenseReportInput,
): Promise<ExpenseReport> {
  const parsed = createExpenseReportInputSchema.parse(input);
  const response = await client.post<unknown>("/expenses/reports", parsed);
  return createdExpenseReportResponseSchema.parse(response).data;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const expenseLineDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .refine(isCalendarDate, "Enter a valid calendar date");

export const addExpenseLineInputSchema = z
  .object({
    description: trimmedRequired.max(500),
    amount: z.number().finite().positive(),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .transform((value) => value.toUpperCase()),
    date: expenseLineDateSchema,
    categoryId: z.string().min(1).optional(),
    travelRequestId: z.string().uuid().optional(),
    receiptUrl: z.string().url().optional(),
    notes: z
      .string()
      .trim()
      .max(2000)
      .transform((value) => value || undefined)
      .optional(),
  })
  .strict();

export type AddExpenseLineInput = z.input<typeof addExpenseLineInputSchema>;

const expenseLineSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    amount: z
      .union([z.string(), z.number().finite()])
      .transform((value) => String(value)),
    currency: z.string().min(1),
    date: z.string().min(1),
    status: z.string().min(1),
    // Edge write responses return hasReceipt only; never echo receiptUrl.
    hasReceipt: z.boolean().optional(),
    receiptUrl: z.unknown().optional(),
  })
  .transform(({ receiptUrl: _receiptUrl, ...line }) => line);

const expenseLineResponseSchema = z
  .object({ data: expenseLineSchema })
  .strict();

export type ExpenseLine = z.infer<typeof expenseLineSchema>;

export async function addExpenseLine(
  client: ApiClient,
  reportId: string,
  input: AddExpenseLineInput,
): Promise<ExpenseLine> {
  const id = z.string().min(1).parse(reportId);
  const parsed = addExpenseLineInputSchema.parse(input);
  const response = await client.post<unknown>(
    `/expenses/reports/${encodeURIComponent(id)}/expenses`,
    parsed,
  );
  return expenseLineResponseSchema.parse(response).data;
}

export async function submitExpenseReport(
  client: ApiClient,
  reportId: string,
): Promise<ExpenseReport> {
  const id = z.string().min(1).parse(reportId);
  const response = await client.post<unknown>(
    `/expenses/reports/${encodeURIComponent(id)}/submit`,
    {},
  );
  return createdExpenseReportResponseSchema.parse(response).data;
}

export function canSubmitExpenseReport(
  status: ExpenseReportStatus,
  lineCount: number,
): boolean {
  return status === "draft" && lineCount > 0;
}

export function canActOnExpenseReport(status: ExpenseReportStatus): boolean {
  return status === "submitted";
}

export const rejectExpenseReportInputSchema = z
  .object({
    reason: z.string().trim().min(1, "Reason is required").max(1000),
  })
  .strict();

export type RejectExpenseReportInput = z.input<
  typeof rejectExpenseReportInputSchema
>;

export async function approveExpenseReport(
  client: ApiClient,
  reportId: string,
): Promise<ExpenseReport> {
  const id = z.string().min(1).parse(reportId);
  const response = await client.post<unknown>(
    `/expenses/reports/${encodeURIComponent(id)}/approve`,
    {},
  );
  return createdExpenseReportResponseSchema.parse(response).data;
}

export async function rejectExpenseReport(
  client: ApiClient,
  reportId: string,
  input: RejectExpenseReportInput,
): Promise<ExpenseReport> {
  const id = z.string().min(1).parse(reportId);
  const parsed = rejectExpenseReportInputSchema.parse(input);
  const response = await client.post<unknown>(
    `/expenses/reports/${encodeURIComponent(id)}/reject`,
    parsed,
  );
  return createdExpenseReportResponseSchema.parse(response).data;
}

const expenseFormEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const expenseFormEntitiesResponseSchema = z
  .object({ data: z.array(expenseFormEntitySchema) })
  .strict();

export type ExpenseFormEntity = z.infer<typeof expenseFormEntitySchema>;

export const EXPENSE_FORM_ENTITIES_QUERY_KEY = [
  "expenses",
  "form-entities",
] as const;

export async function listExpenseFormEntities(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<ExpenseFormEntity[]> {
  const response = await client.get<unknown>(
    "/expenses/meta/entities",
    signal ? { signal } : undefined,
  );
  return expenseFormEntitiesResponseSchema.parse(response).data;
}
