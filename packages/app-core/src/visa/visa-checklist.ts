import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

export const visaChecklistCategorySchema = z.enum(["document", "step"]);

const visaChecklistItemApiSchema = z
  .object({
    id: z.string().min(1),
    visaRecordId: z.string().min(1),
    templateItemId: z.string().min(1),
    label: z.string().min(1),
    category: visaChecklistCategorySchema,
    optional: z.boolean(),
    completed: z.boolean(),
    completedAt: z.string().nullable(),
    completedById: z.string().nullable(),
    sortOrder: z.number().int(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
  })
  .passthrough();

export const visaChecklistItemSchema = visaChecklistItemApiSchema.transform(
  (item) => ({
    id: item.id,
    visaRecordId: item.visaRecordId,
    templateItemId: item.templateItemId,
    label: item.label,
    category: item.category,
    optional: item.optional,
    completed: item.completed,
    completedAt: item.completedAt,
    completedById: item.completedById,
    sortOrder: item.sortOrder,
  }),
);

const visaChecklistResponseSchema = z
  .object({
    data: z.array(visaChecklistItemSchema),
  })
  .strict();

const toggleVisaChecklistItemResponseSchema = z
  .object({
    data: visaChecklistItemSchema,
  })
  .strict();

export const toggleVisaChecklistItemInputSchema = z
  .object({
    completed: z.boolean(),
  })
  .strict();

export type VisaChecklistCategory = z.infer<typeof visaChecklistCategorySchema>;
export type VisaChecklistItem = z.infer<typeof visaChecklistItemSchema>;
export type ToggleVisaChecklistItemInput = z.input<
  typeof toggleVisaChecklistItemInputSchema
>;

export const VISA_CHECKLIST_QUERY_ROOT = ["visa", "checklist"] as const;

export function visaChecklistQueryKey(visaRecordId: string) {
  return [...VISA_CHECKLIST_QUERY_ROOT, visaRecordId] as const;
}

export async function getVisaChecklist(
  client: ApiClient,
  visaRecordId: string,
  signal?: RequestAbortSignal,
): Promise<VisaChecklistItem[]> {
  const id = z.string().min(1).parse(visaRecordId);
  const response = await client.get<unknown>(
    `/visa-checklist/record/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return visaChecklistResponseSchema.parse(response).data;
}

export async function toggleVisaChecklistItem(
  client: ApiClient,
  visaRecordId: string,
  itemId: string,
  input: ToggleVisaChecklistItemInput,
): Promise<VisaChecklistItem> {
  const recordId = z.string().min(1).parse(visaRecordId);
  const id = z.string().min(1).parse(itemId);
  const parsed = toggleVisaChecklistItemInputSchema.parse(input);
  const response = await client.post<unknown>(
    `/visa-checklist/record/${encodeURIComponent(recordId)}/items/${encodeURIComponent(id)}/toggle`,
    parsed,
  );
  return toggleVisaChecklistItemResponseSchema.parse(response).data;
}
