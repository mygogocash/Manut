import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

const contactSchema = z.object({
  name: z.string().min(1, "Contact name is required").max(200),
  title: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  isPrimary: z.boolean().default(false),
});

// Mirror Projects' department whitelist so /partners + /projects share
// the same filter set. Keep nullable on writes (clearing the column).
export const PARTNER_DEPARTMENT_VALUES = [
  "Management",
  "Business Team",
  "Marketing",
  "Product",
  "Project",
  "IT",
  "HR",
  "Accounting",
  "Finance",
  "Finance & Accounting",
  "Legal",
  "Digital Social",
  "Operations",
  "Other",
] as const;
export const partnerDepartmentSchema = z.enum(PARTNER_DEPARTMENT_VALUES);

const partnerBodySchema = z.object({
  company: z.string().min(1, "Company name is required").max(300),
  type: z.string().min(1, "Type is required"),
  status: z.string().default("prospect"),
  region: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().max(5000).optional(),
  contractValue: z.coerce.number().nonnegative().optional(),
  contractStart: dateString.optional(),
  contractEnd: dateString.optional(),
  notes: z.string().max(5000).optional(),
  contacts: z.array(contactSchema).optional(),
  // Projects-style roll-out tracking columns (#534). Nullable so HR
  // can clear a date by submitting `null`; empty strings rejected to
  // force the caller to be deliberate.
  productionLiveDate: dateString.nullable().optional(),
  goLiveDate: dateString.nullable().optional(),
  revisedGoLiveDate: dateString.nullable().optional(),
  pastCampaignDate: dateString.nullable().optional(),
  nextCampaignDate: dateString.nullable().optional(),
  dependency: z.string().max(200).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
  department: partnerDepartmentSchema.nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
});

const partnerContractOrderRefine = (data: {
  contractStart?: string;
  contractEnd?: string;
}) => {
  if (!data.contractStart || !data.contractEnd) return true;
  return data.contractEnd >= data.contractStart;
};

export const createPartnerSchema = partnerBodySchema.refine(
  partnerContractOrderRefine,
  {
    message: "Contract end must not be before contract start",
    path: ["contractEnd"],
  },
);

export const updatePartnerSchema = partnerBodySchema
  .partial()
  .refine(partnerContractOrderRefine, {
    message: "Contract end must not be before contract start",
    path: ["contractEnd"],
  });

export const partnerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  type: z.string().optional(),
  status: z.string().optional(),
  department: partnerDepartmentSchema.optional(),
  search: z.string().optional(),
});

// Drag-to-reorder payload — caller submits desired sequence of partner
// ids. Service assigns sort_order = array index. Mirrors the Projects
// reorder endpoint.
export const reorderPartnersSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

// Bulk import — create-new-only, capped at 500.
export const importPartnersSchema = z.object({
  rows: z.array(createPartnerSchema).min(1).max(500),
});

// Bulk partner-task import. Each row references its partner by company
// name and an optional parent task by title (subtasks). Owner isn't
// resolved on import (export emits a display name, not a stable key).
const importPartnerTaskRowSchema = z.object({
  partner: z.string().min(1, "Partner is required").max(300),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  status: z.string().max(100).optional(),
  priority: z.string().max(50).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  parentTitle: z.string().max(500).optional(),
});

export const importPartnerTasksSchema = z.object({
  rows: z.array(importPartnerTaskRowSchema).min(1).max(2000),
});

export type ImportPartnerTaskRow = z.infer<typeof importPartnerTaskRowSchema>;

export const createContactSchema = z.object({
  name: z.string().min(1, "Contact name is required").max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  role: z.string().max(200).optional(),
  isPrimary: z.boolean().default(false),
});

export const updateContactSchema = createContactSchema.partial();

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
export type PartnerQuery = z.infer<typeof partnerQuerySchema>;
export type PartnerDepartment = z.infer<typeof partnerDepartmentSchema>;
export type ReorderPartnersInput = z.infer<typeof reorderPartnersSchema>;
export type ImportPartnersInput = z.infer<typeof importPartnersSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
