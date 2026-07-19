import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const apiMoneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const payrollRunStatusSchema = z.enum(["draft", "approved", "paid"]);

export const payrollPeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM");

const namedPersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

// List/approve receipts strip notes, runner/approver emails, and currencyTotals
// (sensitive aggregate / export detail). Create and payslip downloads stay later.
const payrollRunApiSchema = z
  .object({
    id: z.string().min(1),
    period: payrollPeriodSchema,
    status: payrollRunStatusSchema,
    totalGross: apiMoneySchema,
    totalNet: apiMoneySchema,
    totalTax: apiMoneySchema,
    createdAt: z.string().min(1),
    notes: z.unknown().optional(),
    currencyTotals: z.unknown().optional(),
    entity: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    }),
    runner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().optional(),
      })
      .passthrough(),
    approver: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().optional(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

export const payrollRunSchema = payrollRunApiSchema.transform((run) => ({
  id: run.id,
  period: run.period,
  status: run.status,
  totalGross: run.totalGross,
  totalNet: run.totalNet,
  totalTax: run.totalTax,
  createdAt: run.createdAt,
  entity: { id: run.entity.id, name: run.entity.name },
  runner: namedPersonSchema.parse(run.runner),
  approver: run.approver
    ? namedPersonSchema.parse(run.approver)
    : null,
}));

const payrollRunsResponseSchema = z
  .object({
    data: z.array(payrollRunSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const payrollRunListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: payrollRunStatusSchema.optional(),
    period: payrollPeriodSchema.optional(),
    entityId: z.string().min(1).optional(),
  })
  .strict();

export type PayrollRunStatus = z.infer<typeof payrollRunStatusSchema>;
export type PayrollRun = z.infer<typeof payrollRunSchema>;
export type PayrollRunListParams = z.input<typeof payrollRunListParamsSchema>;
export type PayrollRunList = z.infer<typeof payrollRunsResponseSchema>;

export const PAYROLL_RUNS_QUERY_ROOT = ["payroll", "runs"] as const;

export function payrollRunsQueryKey(params: PayrollRunListParams = {}) {
  return [
    ...PAYROLL_RUNS_QUERY_ROOT,
    payrollRunListParamsSchema.parse(params),
  ] as const;
}

function encodePayrollQuery(
  params: z.output<typeof payrollRunListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
    ["period", params.period],
    ["entityId", params.entityId],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listPayrollRuns(
  client: ApiClient,
  params: PayrollRunListParams = {},
  signal?: RequestAbortSignal,
): Promise<PayrollRunList> {
  const query = encodePayrollQuery(payrollRunListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/payroll/runs?${query}`,
    signal ? { signal } : undefined,
  );
  return payrollRunsResponseSchema.parse(response);
}

const approvePayrollRunResponseSchema = z
  .object({
    data: payrollRunSchema,
  })
  .strict();

export async function approvePayrollRun(
  client: ApiClient,
  runId: string,
): Promise<PayrollRun> {
  const id = z.string().min(1).parse(runId);
  const response = await client.put<unknown>(
    `/payroll/runs/${encodeURIComponent(id)}/approve`,
    {},
  );
  return approvePayrollRunResponseSchema.parse(response).data;
}

// Self-scoped payslips. Strip documentUrl / bank / allowance detail —
// download/export belong to a later slice. Expose hasDocument only.
const myPayslipApiSchema = z
  .object({
    id: z.string().min(1),
    baseSalary: apiMoneySchema,
    grossPay: apiMoneySchema,
    netPay: apiMoneySchema,
    currency: z.string().min(1),
    documentUrl: z.unknown().optional(),
    hasDocument: z.boolean().optional(),
    allowances: z.unknown().optional(),
    deductions: z.unknown().optional(),
    employeeId: z.unknown().optional(),
    grossPayBase: z.unknown().optional(),
    netPayBase: z.unknown().optional(),
    positionSnapshot: z.unknown().optional(),
    departmentSnapshot: z.unknown().optional(),
    startDateSnapshot: z.unknown().optional(),
    payrollRun: z.object({
      id: z.string().min(1),
      period: payrollPeriodSchema,
      status: payrollRunStatusSchema,
      entity: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
      }),
    }),
  })
  .passthrough();

function resolveMyPayslipHasDocument(record: {
  documentUrl?: unknown;
  hasDocument?: boolean;
}): boolean {
  if (typeof record.hasDocument === "boolean") return record.hasDocument;
  return Boolean(record.documentUrl);
}

export const myPayslipSchema = myPayslipApiSchema.transform((slip) => ({
  id: slip.id,
  baseSalary: slip.baseSalary,
  grossPay: slip.grossPay,
  netPay: slip.netPay,
  currency: slip.currency,
  hasDocument: resolveMyPayslipHasDocument(slip),
  payrollRun: {
    id: slip.payrollRun.id,
    period: slip.payrollRun.period,
    status: slip.payrollRun.status,
    entity: {
      id: slip.payrollRun.entity.id,
      name: slip.payrollRun.entity.name,
    },
  },
}));

const myPayslipsResponseSchema = z
  .object({
    data: z.array(myPayslipSchema),
  })
  .strict();

export type MyPayslip = z.infer<typeof myPayslipSchema>;
export type MyPayslipList = z.infer<typeof myPayslipsResponseSchema>;

export const MY_PAYSLIPS_QUERY_KEY = ["payroll", "my-payslips"] as const;

export async function listMyPayslips(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<MyPayslipList> {
  const response = await client.get<unknown>(
    "/payroll/my-payslips",
    signal ? { signal } : undefined,
  );
  return myPayslipsResponseSchema.parse(response);
}
