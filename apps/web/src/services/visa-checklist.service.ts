import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export type ChecklistCategory = "document" | "step";

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  category: ChecklistCategory;
  optional: boolean;
  sortOrder: number;
}

export interface VisaChecklistTemplate {
  id: string;
  visaType: string;
  country: string | null;
  name: string;
  items: ChecklistTemplateItem[];
  isActive: boolean;
  entityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisaChecklistItem {
  id: string;
  visaRecordId: string;
  templateItemId: string;
  label: string;
  category: ChecklistCategory;
  optional: boolean;
  completed: boolean;
  completedAt: string | null;
  completedById: string | null;
  sortOrder: number;
}

export interface ChecklistTemplateInput {
  visaType: string;
  country?: string;
  name: string;
  items: ChecklistTemplateItem[];
  isActive?: boolean;
}

export async function listChecklistTemplates(params?: {
  visaType?: string;
  includeInactive?: boolean;
}): Promise<ApiSuccessResponse<VisaChecklistTemplate[]>> {
  const qs = new URLSearchParams();
  if (params?.visaType) qs.set("visaType", params.visaType);
  if (params?.includeInactive) qs.set("includeInactive", "true");
  const s = qs.toString();
  return api.get(`/visa-checklist/templates${s ? `?${s}` : ""}`);
}

export async function createChecklistTemplate(
  input: ChecklistTemplateInput,
): Promise<ApiSuccessResponse<VisaChecklistTemplate>> {
  return api.post("/visa-checklist/templates", input);
}

export async function updateChecklistTemplate(
  id: string,
  input: Partial<ChecklistTemplateInput>,
): Promise<ApiSuccessResponse<VisaChecklistTemplate>> {
  return api.put(`/visa-checklist/templates/${id}`, input);
}

export async function deactivateChecklistTemplate(
  id: string,
): Promise<ApiSuccessResponse<VisaChecklistTemplate>> {
  return api.delete(`/visa-checklist/templates/${id}`);
}

export async function getVisaChecklist(
  visaRecordId: string,
): Promise<ApiSuccessResponse<VisaChecklistItem[]>> {
  return api.get(`/visa-checklist/record/${visaRecordId}`);
}

export async function toggleVisaChecklistItem(
  visaRecordId: string,
  itemId: string,
  completed: boolean,
): Promise<ApiSuccessResponse<VisaChecklistItem>> {
  return api.post(
    `/visa-checklist/record/${visaRecordId}/items/${itemId}/toggle`,
    { completed },
  );
}
