import { z } from "zod";

export const createContactSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(150).optional(),
  // First contact created on an Account is auto-promoted to primary by the
  // service; clients can also force it via this flag.
  isPrimary: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
});

// accountId is immutable post-create. Promote-to-primary uses isPrimary.
export const updateContactSchema = createContactSchema
  .partial()
  .omit({ accountId: true });

export const listContactsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  accountId: z.string().optional(),
  // Archived is orthogonal to the other filters: true = archived only,
  // omitted/false = active only. Query string comes in as "true"/"false".
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsQuery = z.infer<typeof listContactsSchema>;
