import { api, apiBaseUrl, authFetchInit } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type MonthName = (typeof MONTH_NAMES)[number];

export interface EquityMonthlySalary {
  id: string;
  employeeName: string;
  position: string | null;
  startDate: string | null;
  currency: string | null;
  year: number;
  // Three-letter month abbrev → share count.
  monthlyShares: Partial<Record<MonthName, number>>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquitySalaryImportResult {
  year: number;
  importedRows: number;
  parseErrors: { rowNumber: number; errors: string[] }[];
}

export interface EquitySalaryListParams {
  year?: number;
}

export async function listEquitySalaries(
  params: EquitySalaryListParams = {},
): Promise<ApiSuccessResponse<EquityMonthlySalary[]>> {
  const qs = new URLSearchParams();
  if (params.year !== undefined) qs.set("year", String(params.year));
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/hrms/equity-monthly-salary${tail}`);
}

export async function importEquitySalaries(
  file: File,
): Promise<ApiSuccessResponse<EquitySalaryImportResult>> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${apiBaseUrl}/hrms/equity-monthly-salary/import`, {
    ...authFetchInit(),
    method: "POST",
    body: formData,
  });
  const json = (await res.json()) as
    ApiSuccessResponse<EquitySalaryImportResult> | { error?: string };
  if (!res.ok) {
    const message = ("error" in json && json.error) || "Import failed";
    throw new Error(typeof message === "string" ? message : "Import failed");
  }
  return json as ApiSuccessResponse<EquitySalaryImportResult>;
}

export async function deleteAllEquitySalaries(): Promise<
  ApiSuccessResponse<{ deletedCount: number }>
> {
  return api.delete("/hrms/equity-monthly-salary");
}
