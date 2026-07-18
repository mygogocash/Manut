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

// List receipts strip notes, runner/approver emails, and currencyTotals
// (sensitive aggregate / export detail). Create/approve/payslip downloads
// belong to later slices.
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
