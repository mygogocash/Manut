import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

// Manage-oriented list projection: keep template identity + item count.
export const visaChecklistTemplateSchema = z
  .object({
    id: z.string().min(1),
    visaType: z.string().min(1),
    country: nullableText.optional(),
    name: z.string().min(1),
    items: z.array(z.unknown()).default([]),
    isActive: z.boolean(),
  })
  .passthrough()
  .transform((template) => ({
    id: template.id,
    visaType: template.visaType,
    country: template.country ?? null,
    name: template.name,
    itemCount: template.items.length,
    isActive: template.isActive,
  }));

const visaChecklistTemplatesResponseSchema = z
  .object({
    data: z.array(visaChecklistTemplateSchema),
  })
  .strict();

export type VisaChecklistTemplate = z.infer<typeof visaChecklistTemplateSchema>;

export const VISA_CHECKLIST_TEMPLATES_QUERY_KEY = [
  "visa",
  "checklist-templates",
] as const;

export async function listVisaChecklistTemplates(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<VisaChecklistTemplate[]> {
  const response = await client.get<unknown>(
    "/visa-checklist/templates",
    signal ? { signal } : undefined,
  );
  return visaChecklistTemplatesResponseSchema.parse(response).data;
}
