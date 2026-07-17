import { z } from "zod";

export const uploadBase64Schema = z.object({
  base64: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  bucket: z
    .enum(["article", "avatars", "blog", "receipts", "documents", "uploads"])
    .default("uploads"),
  purpose: z.string().optional(),
  linkedTo: z.string().optional(),
  linkedId: z.string().optional(),
});

export const listUploadsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type UploadBase64Input = z.infer<typeof uploadBase64Schema>;
