import { z } from "zod";

export const createCertificateSchema = z.object({
  recipientId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  message: z.string().trim().max(2000).optional(),
  type: z
    .enum(["achievement", "appreciation", "recognition"])
    .default("achievement"),
  signatories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        title: z.string().trim().max(120).default(""),
        // Supabase storage URL of an uploaded PNG/JPG signature image
        // (public or signed form). Resolved + validated server-side before
        // it is embedded into the PDF.
        signatureUrl: z.string().trim().url().max(2048).optional(),
      }),
    )
    .max(2)
    .default([]),
});

export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;

export const listCertificatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  recipientId: z.string().uuid().optional(),
  status: z.enum(["draft", "issued"]).optional(),
  // "active" = not reverted (default); "reverted" = soft-deleted only.
  view: z.enum(["active", "reverted"]).default("active"),
});

export type ListCertificatesQuery = z.infer<typeof listCertificatesSchema>;
