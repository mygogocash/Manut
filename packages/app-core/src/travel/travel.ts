import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

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

export const travelDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .refine(isCalendarDate, "Enter a valid calendar date");

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z
  .string()
  .min(10)
  .transform(toCalendarDate)
  .pipe(travelDateSchema);

export const travelCategorySchema = z.enum(["general", "business_or_bd"]);

export const travelRequestStatusSchema = z.enum([
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "completed",
  "archived",
]);

const travelEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  department: nullableText,
});

const trimmedRequired = z.string().trim().min(1);

// List/create receipts strip approval-chain internals and linked expenses.
// `viewerCanAct` is server-computed for the current approver step.
export const travelRequestSchema = z.object({
  id: z.string().min(1),
  requestCode: z.string().min(1),
  origin: nullableText,
  destination: z.string().min(1),
  purpose: z.string().min(1),
  departureDate: apiCalendarDateSchema,
  returnDate: apiCalendarDateSchema,
  estimatedBudget: nullableText,
  cashAdvance: nullableText,
  currency: z.string().min(1),
  category: travelCategorySchema,
  status: travelRequestStatusSchema,
  createdAt: z.string().min(1),
  employee: travelEmployeeSchema,
  viewerCanAct: z.boolean().default(false),
});

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const travelRequestsResponseSchema = z
  .object({
    data: z.array(travelRequestSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const createdTravelRequestResponseSchema = z
  .object({ data: travelRequestSchema })
  .strict();

export const createTravelRequestInputSchema = z
  .object({
    origin: trimmedRequired,
    destination: trimmedRequired,
    purpose: trimmedRequired,
    departureDate: travelDateSchema,
    returnDate: travelDateSchema,
    category: travelCategorySchema.default("general"),
    currency: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.toUpperCase())
      .default("USD"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.returnDate < value.departureDate) {
      context.addIssue({
        code: "custom",
        message: "Return date must not be before departure date",
        path: ["returnDate"],
      });
    }
  });

const trimmedOptional = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const travelRequestListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    employeeId: z.string().uuid().optional(),
    status: travelRequestStatusSchema.optional(),
    search: trimmedOptional,
  })
  .strict();

export type TravelCategory = z.infer<typeof travelCategorySchema>;
export type TravelRequestStatus = z.infer<typeof travelRequestStatusSchema>;
export type TravelRequest = z.infer<typeof travelRequestSchema>;
export type CreateTravelRequestInput = z.input<
  typeof createTravelRequestInputSchema
>;
export type CreatedTravelRequest = z.infer<typeof travelRequestSchema>;
export type TravelRequestListParams = z.input<
  typeof travelRequestListParamsSchema
>;
export type TravelRequestList = z.infer<typeof travelRequestsResponseSchema>;

export const TRAVEL_REQUESTS_QUERY_ROOT = ["travel", "requests", "self"] as const;

export function travelRequestsQueryKey(params: TravelRequestListParams) {
  return [
    ...TRAVEL_REQUESTS_QUERY_ROOT,
    travelRequestListParamsSchema.parse(params),
  ] as const;
}

function encodeTravelRequestQuery(
  params: z.output<typeof travelRequestListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["employeeId", params.employeeId],
    ["status", params.status],
    ["search", params.search],
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

export async function getTravelRequests(
  client: ApiClient,
  params: TravelRequestListParams,
  signal?: RequestAbortSignal,
): Promise<TravelRequestList> {
  const query = encodeTravelRequestQuery(
    travelRequestListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/travel/requests?${query}`,
    signal ? { signal } : undefined,
  );
  return travelRequestsResponseSchema.parse(response);
}

export async function createTravelRequest(
  client: ApiClient,
  input: CreateTravelRequestInput,
): Promise<CreatedTravelRequest> {
  const parsedInput = createTravelRequestInputSchema.parse(input);
  const response = await client.post<unknown>("/travel/requests", parsedInput);
  return createdTravelRequestResponseSchema.parse(response).data;
}

export async function cancelTravelRequest(
  client: ApiClient,
  requestId: string,
): Promise<CreatedTravelRequest> {
  const id = z.string().min(1).parse(requestId);
  const response = await client.put<unknown>(
    `/travel/requests/${encodeURIComponent(id)}/cancel`,
  );
  return createdTravelRequestResponseSchema.parse(response).data;
}

export function canCancelTravelRequest(
  status: TravelRequestStatus,
): boolean {
  return status === "pending" || status === "draft";
}

export const rejectTravelRequestInputSchema = z
  .object({
    reason: z.string().trim().min(1, "Reason is required").max(1000),
  })
  .strict();

export type RejectTravelRequestInput = z.input<
  typeof rejectTravelRequestInputSchema
>;

export async function approveTravelRequest(
  client: ApiClient,
  requestId: string,
): Promise<CreatedTravelRequest> {
  const id = z.string().min(1).parse(requestId);
  const response = await client.put<unknown>(
    `/travel/requests/${encodeURIComponent(id)}/approve`,
  );
  return createdTravelRequestResponseSchema.parse(response).data;
}

export async function rejectTravelRequest(
  client: ApiClient,
  requestId: string,
  input: RejectTravelRequestInput,
): Promise<CreatedTravelRequest> {
  const id = z.string().min(1).parse(requestId);
  const parsed = rejectTravelRequestInputSchema.parse(input);
  const response = await client.put<unknown>(
    `/travel/requests/${encodeURIComponent(id)}/reject`,
    parsed,
  );
  return createdTravelRequestResponseSchema.parse(response).data;
}

export const addTravelAttachmentsInputSchema = z
  .object({
    attachments: z
      .array(
        z
          .object({
            name: z.string().trim().min(1),
            url: z.string().url(),
            type: z.string().trim().min(1).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type AddTravelAttachmentsInput = z.input<
  typeof addTravelAttachmentsInputSchema
>;

export async function addTravelAttachments(
  client: ApiClient,
  requestId: string,
  input: AddTravelAttachmentsInput,
): Promise<CreatedTravelRequest> {
  const id = z.string().min(1).parse(requestId);
  const parsed = addTravelAttachmentsInputSchema.parse(input);
  const response = await client.post<unknown>(
    `/travel/requests/${encodeURIComponent(id)}/attachments`,
    parsed,
  );
  return createdTravelRequestResponseSchema.parse(response).data;
}
