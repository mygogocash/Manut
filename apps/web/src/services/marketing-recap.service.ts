import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

/** Per-telco business targets for the Daily Recap. */
export interface RecapTarget {
  partnerId: string;
  targetDau: number | null;
  addressableMau: number | null;
  excluded: boolean;
}

/** The briefing bullets for one calendar day. */
export interface RecapNotes {
  yesterday: string[];
  today: string[];
}

export function getRecapTargets() {
  return api.get<ApiSuccessResponse<RecapTarget[]>>("/marketing-recap/targets");
}

/** Admin only. */
export function putRecapTargets(targets: RecapTarget[]) {
  return api.put<ApiSuccessResponse<RecapTarget[]>>(
    "/marketing-recap/targets",
    targets,
  );
}

export function getRecapNotes(date: string) {
  return api.get<ApiSuccessResponse<RecapNotes>>(
    `/marketing-recap/notes/${date}`,
  );
}

export function putRecapNotes(date: string, notes: RecapNotes) {
  return api.put<ApiSuccessResponse<RecapNotes>>(
    `/marketing-recap/notes/${date}`,
    notes,
  );
}
