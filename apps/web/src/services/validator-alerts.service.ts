import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export type AlertField = "balance" | "burn" | "runway";
export type AlertOperator = "lt" | "lte" | "gt" | "gte" | "eq";

export interface ValidatorNodeAlert {
  id: string;
  name: string;
  nodeId: string | null;
  field: AlertField;
  operator: AlertOperator;
  // Decimal serialized as string by Prisma. Convert at the UI layer.
  threshold: string;
  email: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateValidatorAlertInput {
  name: string;
  nodeId: string | null;
  field: AlertField;
  operator: AlertOperator;
  threshold: number;
  email: string;
  enabled?: boolean;
  cooldownMinutes?: number;
}

export type UpdateValidatorAlertInput = Partial<CreateValidatorAlertInput>;

export function listValidatorAlerts() {
  return api.get<ApiSuccessResponse<ValidatorNodeAlert[]>>(
    "/validator-monitor/alerts",
  );
}

export function createValidatorAlert(input: CreateValidatorAlertInput) {
  return api.post<ApiSuccessResponse<ValidatorNodeAlert>>(
    "/validator-monitor/alerts",
    input,
  );
}

export function updateValidatorAlert(
  id: string,
  input: UpdateValidatorAlertInput,
) {
  return api.put<ApiSuccessResponse<ValidatorNodeAlert>>(
    `/validator-monitor/alerts/${id}`,
    input,
  );
}

export function deleteValidatorAlert(id: string) {
  return api.delete<void>(`/validator-monitor/alerts/${id}`);
}

export const ALERT_FIELD_LABEL: Record<AlertField, string> = {
  balance: "Balance (AVAX)",
  burn: "Burn / day (AVAX)",
  runway: "Runway (days)",
};

export const ALERT_OPERATOR_LABEL: Record<AlertOperator, string> = {
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  eq: "=",
};
