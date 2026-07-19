import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z.string().min(10).transform(toCalendarDate);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const cashAdvanceStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "rejected",
  "disbursed",
  "cleared",
]);

export const cashAdvancePayoutModeSchema = z.enum(["cash", "bank-transfer"]);

const cashAdvanceEmployeeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.unknown().optional(),
  })
  .passthrough()
  .transform((employee) => ({
    id: employee.id,
    name: employee.name,
  }));

// List receipts keep totals/status and strip bank numbers, notes, proof
// URLs, approval-chain internals, line receipt URLs, and employee email.
const cashAdvanceRequestApiSchema = z
  .object({
    id: z.string().min(1),
    requestNumber: z.number().int().nonnegative(),
    requestDate: apiCalendarDateSchema,
    payoutMode: cashAdvancePayoutModeSchema,
    currency: z.string().min(1),
    status: cashAdvanceStatusSchema,
    requestedTotal: z.number().finite(),
    approvedTotal: z.number().finite(),
    rejectReason: nullableText,
    employee: cashAdvanceEmployeeSchema,
    entity: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .nullable()
      .optional(),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).optional(),
            description: z.string().optional(),
          })
          .passthrough(),
      )
      .default([]),
    notes: z.unknown().optional(),
    bankAccountNo: z.unknown().optional(),
    bankName: z.unknown().optional(),
    disbursementProofUrl: z.unknown().optional(),
    approvalChain: z.unknown().optional(),
  })
  .passthrough();

export const cashAdvanceRequestSchema = cashAdvanceRequestApiSchema.transform(
  (request) => ({
    id: request.id,
    requestNumber: request.requestNumber,
    requestDate: request.requestDate,
    payoutMode: request.payoutMode,
    currency: request.currency,
    status: request.status,
    requestedTotal: request.requestedTotal,
    approvedTotal: request.approvedTotal,
    rejectReason: request.rejectReason,
    itemCount: request.items.length,
    employee: request.employee,
    entityName: request.entity?.name ?? null,
  }),
);

const cashAdvanceListResponseSchema = z
  .object({
    data: z.array(cashAdvanceRequestSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const cashAdvanceMutationResponseSchema = z
  .object({
    data: cashAdvanceRequestSchema,
  })
  .strict();

export const cashAdvanceListParamsSchema = z
  .object({
    scope: z.enum(["mine", "all"]).default("mine"),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: cashAdvanceStatusSchema.optional(),
  })
  .strict();

const trimmedRequired = z.string().trim().min(1);

export const createCashAdvanceItemInputSchema = z
  .object({
    description: trimmedRequired.max(500),
    requestedAmount: z.number().finite().nonnegative(),
  })
  .strict();

export const createCashAdvanceInputSchema = z
  .object({
    payoutMode: cashAdvancePayoutModeSchema.default("cash"),
    bankName: z.string().trim().max(120).optional(),
    bankAccountNo: z.string().trim().max(120).optional(),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .transform((value) => value.toUpperCase())
      .default("THB"),
    notes: z
      .string()
      .trim()
      .max(2000)
      .transform((value) => value || undefined)
      .optional(),
    items: z.array(createCashAdvanceItemInputSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.payoutMode === "bank-transfer") {
      if (!value.bankName?.trim() || !value.bankAccountNo?.trim()) {
        context.addIssue({
          code: "custom",
          message: "Bank name and account number are required for bank transfer",
          path: ["bankName"],
        });
      }
    }
  });

export type CashAdvanceStatus = z.infer<typeof cashAdvanceStatusSchema>;
export type CashAdvancePayoutMode = z.infer<typeof cashAdvancePayoutModeSchema>;
export type CashAdvanceRequest = z.infer<typeof cashAdvanceRequestSchema>;
export type CashAdvanceListParams = z.input<typeof cashAdvanceListParamsSchema>;
export type CashAdvanceList = z.infer<typeof cashAdvanceListResponseSchema>;
export type CreateCashAdvanceInput = z.input<
  typeof createCashAdvanceInputSchema
>;

export const CASH_ADVANCES_QUERY_ROOT = ["cash-advance", "list"] as const;

export function cashAdvancesQueryKey(params: CashAdvanceListParams = {}) {
  return [
    ...CASH_ADVANCES_QUERY_ROOT,
    cashAdvanceListParamsSchema.parse(params),
  ] as const;
}

function encodeCashAdvanceQuery(
  params: z.output<typeof cashAdvanceListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["scope", params.scope],
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
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

export async function listCashAdvances(
  client: ApiClient,
  params: CashAdvanceListParams = {},
  signal?: RequestAbortSignal,
): Promise<CashAdvanceList> {
  const query = encodeCashAdvanceQuery(cashAdvanceListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/cash-advance?${query}`,
    signal ? { signal } : undefined,
  );
  return cashAdvanceListResponseSchema.parse(response);
}

export async function createCashAdvance(
  client: ApiClient,
  input: CreateCashAdvanceInput,
): Promise<CashAdvanceRequest> {
  const parsed = createCashAdvanceInputSchema.parse(input);
  const response = await client.post<unknown>("/cash-advance", parsed);
  return cashAdvanceMutationResponseSchema.parse(response).data;
}

export async function submitCashAdvance(
  client: ApiClient,
  requestId: string,
): Promise<CashAdvanceRequest> {
  const id = z.string().min(1).parse(requestId);
  const response = await client.post<unknown>(
    `/cash-advance/${encodeURIComponent(id)}/submit`,
    {},
  );
  return cashAdvanceMutationResponseSchema.parse(response).data;
}

export async function deleteCashAdvance(
  client: ApiClient,
  requestId: string,
): Promise<void> {
  const id = z.string().min(1).parse(requestId);
  await client.delete(`/cash-advance/${encodeURIComponent(id)}`);
}

export function canSubmitCashAdvance(status: CashAdvanceStatus): boolean {
  return status === "draft" || status === "rejected";
}

export function canDeleteCashAdvanceDraft(status: CashAdvanceStatus): boolean {
  return status === "draft";
}

export function canActOnCashAdvance(status: CashAdvanceStatus): boolean {
  return status === "submitted";
}

export const rejectCashAdvanceInputSchema = z
  .object({
    reason: z.string().trim().min(1, "Reason is required").max(1000),
  })
  .strict();

export type RejectCashAdvanceInput = z.input<
  typeof rejectCashAdvanceInputSchema
>;

export async function approveCashAdvance(
  client: ApiClient,
  requestId: string,
): Promise<CashAdvanceRequest> {
  const id = z.string().min(1).parse(requestId);
  const response = await client.post<unknown>(
    `/cash-advance/${encodeURIComponent(id)}/approve`,
    {},
  );
  return cashAdvanceMutationResponseSchema.parse(response).data;
}

export async function rejectCashAdvance(
  client: ApiClient,
  requestId: string,
  input: RejectCashAdvanceInput,
): Promise<CashAdvanceRequest> {
  const id = z.string().min(1).parse(requestId);
  const parsed = rejectCashAdvanceInputSchema.parse(input);
  const response = await client.post<unknown>(
    `/cash-advance/${encodeURIComponent(id)}/reject`,
    parsed,
  );
  return cashAdvanceMutationResponseSchema.parse(response).data;
}

export function canDisburseCashAdvance(status: CashAdvanceStatus): boolean {
  return status === "approved";
}

export function canClearCashAdvance(status: CashAdvanceStatus): boolean {
  return status === "disbursed";
}

export const disburseCashAdvanceInputSchema = z
  .object({
    proofUrl: z
      .string()
      .trim()
      .url("Disbursement proof file is required"),
  })
  .strict();

export type DisburseCashAdvanceInput = z.input<
  typeof disburseCashAdvanceInputSchema
>;

export async function disburseCashAdvance(
  client: ApiClient,
  requestId: string,
  input: DisburseCashAdvanceInput,
): Promise<CashAdvanceRequest> {
  const id = z.string().min(1).parse(requestId);
  const parsed = disburseCashAdvanceInputSchema.parse(input);
  const response = await client.post<unknown>(
    `/cash-advance/${encodeURIComponent(id)}/disburse`,
    parsed,
  );
  return cashAdvanceMutationResponseSchema.parse(response).data;
}

export async function clearCashAdvance(
  client: ApiClient,
  requestId: string,
): Promise<CashAdvanceRequest> {
  const id = z.string().min(1).parse(requestId);
  const response = await client.post<unknown>(
    `/cash-advance/${encodeURIComponent(id)}/clear`,
    {},
  );
  return cashAdvanceMutationResponseSchema.parse(response).data;
}
