import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Mirrors `HelpdeskNotificationSettings` (see helpdesk.service.ts).
// `notifyEmails` is the BD distribution list emailed on every new
// opportunity and every stage change; toggles let ops mute individual
// fan-outs without losing the recipient list.
export interface CrmNotificationSettings {
  notifyEmails: string[];
  notifyOnCreate: boolean;
  notifyOwnerOnCreate: boolean;
  notifyOwnerOnStageChange: boolean;
  updatedAt: string;
}

export async function getCrmSettings(): Promise<
  ApiSuccessResponse<CrmNotificationSettings>
> {
  return api.get("/sales-revenue/settings");
}

export async function updateCrmSettings(
  input: Omit<CrmNotificationSettings, "updatedAt">,
): Promise<ApiSuccessResponse<CrmNotificationSettings>> {
  return api.put("/sales-revenue/settings", input);
}
