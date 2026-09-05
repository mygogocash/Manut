import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export type CertificateType = "achievement" | "appreciation" | "recognition";
export type CertificateStatus = "draft" | "issued";

export interface CertificateSignatory {
  name: string;
  title: string;
  signatureUrl?: string | null;
}

export interface Certificate {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  title: string;
  message: string | null;
  type: CertificateType;
  signatories: CertificateSignatory[];
  fileUrl: string | null;
  status: CertificateStatus;
  issuedById: string | null;
  issuedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  recipient: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    department: string | null;
  } | null;
  issuedBy: { id: string; name: string } | null;
}

export interface CreateCertificateInput {
  recipientId: string;
  title: string;
  message?: string;
  type: CertificateType;
  signatories: CertificateSignatory[];
}

export type CertificateView = "active" | "reverted";

export interface ListCertificatesParams {
  page?: number;
  limit?: number;
  recipientId?: string;
  status?: CertificateStatus;
  view?: CertificateView;
}

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  achievement: "Achievement",
  appreciation: "Appreciation",
  recognition: "Recognition",
};

function buildQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function listCertificates(
  params: ListCertificatesParams = {},
): Promise<ApiPaginatedResponse<Certificate>> {
  return api.get(
    `/certificates${buildQuery(params as Record<string, unknown>)}`,
  );
}

export async function createCertificate(
  input: CreateCertificateInput,
): Promise<ApiSuccessResponse<Certificate>> {
  return api.post("/certificates", input);
}

export async function getCertificateDownloadUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/certificates/${id}/download`);
}

/** Revert (soft delete): hides the certificate but keeps it restorable. */
export async function revertCertificate(
  id: string,
): Promise<ApiSuccessResponse<Certificate>> {
  return api.delete(`/certificates/${id}`);
}

/** Restore a reverted certificate back to the active list. */
export async function restoreCertificate(
  id: string,
): Promise<ApiSuccessResponse<Certificate>> {
  return api.post(`/certificates/${id}/restore`, {});
}

/** Permanently delete a certificate (record + stored PDF). Not recoverable. */
export async function permanentlyDeleteCertificate(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/certificates/${id}/permanent`);
}
