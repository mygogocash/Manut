import { z } from "zod";

const attachmentSchema = z.object({
  name: z.string().min(1).max(300),
  url: z.string().url(),
  mimeType: z.string().max(200).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const createCompanyDateSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  type: z.string().min(1, "Type is required"),
  location: z.string().optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const updateCompanyDateSchema = createCompanyDateSchema.partial();

export type CreateCompanyDateInput = z.infer<typeof createCompanyDateSchema>;
export type UpdateCompanyDateInput = z.infer<typeof updateCompanyDateSchema>;
