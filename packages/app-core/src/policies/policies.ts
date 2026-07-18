import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const policyCategorySchema = z.enum([
  "handbook",
  "code_of_conduct",
  "hr_policy",
  "it_policy",
  "travel_policy",
  "leave_policy",
  "expense_policy",
  "security_policy",
  "privacy_policy",
  "compliance",
  "other",
]);

// List foundation strips fileUrl, uploader email, and mime/size.
const policyApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    category: policyCategorySchema,
    description: nullableText.optional(),
    fileName: z.string().min(1),
    version: nullableText.optional(),
    effectiveDate: nullableText.optional(),
    isActive: z.boolean(),
    entity: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const companyPolicySchema = policyApiSchema.transform((row) => ({
  id: row.id,
  title: row.title,
  category: row.category,
  description: row.description ?? null,
  fileName: row.fileName,
  version: row.version ?? null,
  effectiveDate: row.effectiveDate ?? null,
  isActive: row.isActive,
  entityName: row.entity?.name ?? null,
}));

const policiesResponseSchema = z
  .object({
    data: z.array(companyPolicySchema),
  })
  .strict();

export type CompanyPolicy = z.infer<typeof companyPolicySchema>;
export type CompanyPolicyList = z.infer<typeof policiesResponseSchema>;
export type PolicyCategory = z.infer<typeof policyCategorySchema>;

export const POLICIES_QUERY_KEY = ["policies", "list"] as const;

export function policiesQueryKey() {
  return POLICIES_QUERY_KEY;
}

export async function listCompanyPolicies(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<CompanyPolicyList> {
  const response = await client.get<unknown>(
    "/policies",
    signal ? { signal } : undefined,
  );
  return policiesResponseSchema.parse(response);
}
