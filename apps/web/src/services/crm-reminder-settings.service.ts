import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Per-CRM deadline-reminder recipient settings. Mirrors the IT CRM
// `getReminderSettings`/`updateReminderSettings` pair (it-crm.service.ts)
// but parameterized over the CRM module — the API mounts one settings
// row per module at `/api/crm/:module/reminder-settings`. Named
// crm-reminder-settings (not crm-settings) because crm-settings.service.ts
// already holds the Sales CRM notification settings client.

export type CrmSettingsModule =
  | "general"
  | "hr"
  | "legal"
  | "accounting"
  | "product"
  | "qa"
  | "sales"
  | "revenue";

export interface CrmReminderSettings {
  recipients: string[];
}

export async function getCrmReminderSettings(
  module: CrmSettingsModule,
): Promise<ApiSuccessResponse<CrmReminderSettings>> {
  return api.get(`/crm/${module}/reminder-settings`);
}

export async function updateCrmReminderSettings(
  module: CrmSettingsModule,
  recipients: string[],
): Promise<ApiSuccessResponse<CrmReminderSettings>> {
  return api.put(`/crm/${module}/reminder-settings`, { recipients });
}
