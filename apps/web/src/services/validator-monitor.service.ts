import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export interface ValidatorReportRow {
  nodeID: string;
  validationID: string;
  balanceAvax: number;
  burnAvaxPerDay: number;
  runwayDays: number;
  alerts: string[];
}

export interface ValidatorReport {
  generatedAt: string;
  subnet: string;
  summary: {
    count: number;
    totalBalanceAvax: number;
    alerting: number;
    minRunwayDays?: number | null;
  };
  rows: ValidatorReportRow[];
  cachedAt: string;
  cached: boolean;
}

export function getValidatorReport(opts: { refresh?: boolean } = {}) {
  const qs = opts.refresh ? "?refresh=1" : "";
  return api.get<ApiSuccessResponse<ValidatorReport>>(
    `/validator-monitor${qs}`,
  );
}
