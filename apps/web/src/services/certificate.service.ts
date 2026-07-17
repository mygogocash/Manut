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

export interface ListCertificatesParams {
  page?: number;
  limit?: number;
  recipientId?: string;
  status?: CertificateStatus;
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

export async function deleteCertificate(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/certificates/${id}`);
}
