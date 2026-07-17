import { z } from "zod";

const DOCUMENT_CATEGORIES = [
  "legal",
  "financial",
  "technical",
  "pitch",
  "other",
] as const;

export const createDocumentSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  description: z.string().max(2000).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).default("other"),
  fileUrl: z.string().url("Must be a valid URL"),
  fileSize: z.coerce
    .number()
    .int()
    .positive("File size must be positive")
    .optional(),
  mimeType: z.string().max(200).optional(),
});

export const updateDocumentSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
});

export const listDocumentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>;

export { DOCUMENT_CATEGORIES };
