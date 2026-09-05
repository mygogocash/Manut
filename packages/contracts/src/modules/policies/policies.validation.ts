import { z } from "zod";

// Curated category list. Keep in sync with the FE labels in
// services/policy.service.ts. Mirrors the HRMS agreement-type pattern.
export const POLICY_CATEGORIES = [
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
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

export const createPolicySchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(POLICY_CATEGORIES),
  description: z.string().max(4000).optional(),
  fileUrl: z.string().url("fileUrl must be a valid URL"),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(120).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  version: z.string().max(40).optional(),
  effectiveDate: dateString,
  entityId: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updatePolicySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.enum(POLICY_CATEGORIES).optional(),
  description: z.string().max(4000).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().min(1).max(200).optional(),
  mimeType: z.string().max(120).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  version: z.string().max(40).optional(),
  effectiveDate: dateString,
  entityId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const listPolicyQuerySchema = z.object({
  category: z.enum(POLICY_CATEGORIES).optional(),
  entityId: z.string().optional(),
  // `includeInactive=true` lets HR see archived policies in the admin
  // table. Default = active only so the employee-facing list never
  // shows retired handbooks.
  includeInactive: z.coerce.boolean().optional(),
  q: z.string().max(200).optional(),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type ListPolicyQuery = z.infer<typeof listPolicyQuerySchema>;
