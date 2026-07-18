import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const publicSigningDocumentSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.string().min(1).optional(),
    fileUrl: z.string().url().nullable().optional(),
    fileName: z.string().nullable().optional(),
    status: z.string().min(1).optional(),
  })
  .passthrough()
  .transform((document) => ({
    id: document.id,
    title: document.title,
    kind: document.kind ?? null,
    fileUrl: document.fileUrl ?? null,
    fileName: document.fileName ?? null,
    status: document.status ?? null,
  }));

const publicSigningSignatureSchema = z
  .object({
    id: z.string().min(1),
    documentId: z.string().min(1),
    signerEmail: z.string().min(1),
    signerName: z.string().min(1),
    status: z.string().min(1),
    inviteMessage: z.string().nullable().optional(),
    signedAt: z.string().nullable().optional(),
    declinedAt: z.string().nullable().optional(),
    declineReason: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((signature) => ({
    id: signature.id,
    documentId: signature.documentId,
    // Keep signer identity needed for the consent form; strip audit/token fields.
    signerEmail: signature.signerEmail,
    signerName: signature.signerName,
    status: signature.status,
    inviteMessage: signature.inviteMessage ?? null,
    signedAt: signature.signedAt ?? null,
    declinedAt: signature.declinedAt ?? null,
    declineReason: signature.declineReason ?? null,
    expiresAt: signature.expiresAt ?? null,
  }));

const publicSigningRequestSchema = z
  .object({
    data: z
      .object({
        signature: publicSigningSignatureSchema,
        document: publicSigningDocumentSchema,
      })
      .strict(),
  })
  .strict();

export type PublicSigningDocument = z.infer<typeof publicSigningDocumentSchema>;
export type PublicSigningSignature = z.infer<
  typeof publicSigningSignatureSchema
>;
export type PublicSigningRequest = z.infer<
  typeof publicSigningRequestSchema
>["data"];

export const PUBLIC_SIGNING_QUERY_ROOT = ["legal-public", "sign"] as const;

export function publicSigningQueryKey(token: string) {
  return [...PUBLIC_SIGNING_QUERY_ROOT, token] as const;
}

export async function getPublicSigningRequest(
  client: ApiClient,
  token: string,
  signal?: RequestAbortSignal,
): Promise<PublicSigningRequest> {
  const response = await client.getPublic<unknown>(
    `/legal-public/sign/${encodeURIComponent(token)}`,
    signal ? { signal } : undefined,
  );
  return publicSigningRequestSchema.parse(response).data;
}
