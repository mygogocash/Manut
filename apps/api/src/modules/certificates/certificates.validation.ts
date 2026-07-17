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
});

export type ListCertificatesQuery = z.infer<typeof listCertificatesSchema>;
