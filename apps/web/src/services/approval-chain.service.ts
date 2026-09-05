import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Project CRM approval chains, API client.
//
// Only the Project CRM has configurable chains. Travel, leave, expenses, cash
// advance and payroll keep their own settings screens and their own HR/Finance
// permissions, deliberately untouched — do not add their names to `ChainScope`
// expecting them to appear here.

export type ChainScope = "project_request" | "proposal";

export const CHAIN_SCOPE_LABELS: Record<ChainScope, string> = {
  project_request: "Project requests",
  proposal: "Proposals",
};

/** What each chain gates, in the words an administrator needs. */
export const CHAIN_SCOPE_HINTS: Record<ChainScope, string> = {
  project_request:
    "Stages a project request passes before development can start. Escalation, sending back and reopening are unaffected.",
  proposal: "Stages a proposal passes before it counts as approved.",
};

export interface ChainStep {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approver: { id: string; name: string; email: string } | null;
  /**
   * A person IS configured but no longer resolves — deactivated, or deleted.
   * Different from "nobody chosen", and needs an administrator to fix it.
   */
  approverMissing: boolean;
  isActive: boolean;
  /**
   * Part of the flow as originally decided. Rename it and change who approves
   * at it, but it cannot be removed — the API refuses, and the UI hides the
   * control for the same reason rather than instead of it.
   */
  isSystem: boolean;
}

export interface Chain {
  id: string;
  scope: ChainScope;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: ChainStep[];
}

export async function listChains(): Promise<ApiSuccessResponse<Chain[]>> {
  return api.get(`/approval-chains`);
}

export async function getChain(
  scope: ChainScope,
): Promise<ApiSuccessResponse<Chain>> {
  return api.get(`/approval-chains/${scope}`);
}

// Every write below is refused by the API unless the caller holds the system
// Admin role. The UI hides them for the same reason, not instead of it.

export async function addChainStep(
  scope: ChainScope,
  input: {
    name: string;
    description?: string | null;
    approverUserId?: string | null;
  },
): Promise<ApiSuccessResponse<Chain>> {
  return api.post(`/approval-chains/${scope}/steps`, input);
}

export async function updateChainStep(
  scope: ChainScope,
  stepId: string,
  input: {
    name?: string;
    description?: string | null;
    approverUserId?: string | null;
    isActive?: boolean;
  },
): Promise<ApiSuccessResponse<Chain>> {
  return api.put(`/approval-chains/${scope}/steps/${stepId}`, input);
}

export async function removeChainStep(
  scope: ChainScope,
  stepId: string,
): Promise<ApiSuccessResponse<Chain>> {
  return api.delete(`/approval-chains/${scope}/steps/${stepId}`);
}

/** Must list every stage of the chain exactly once; the API refuses a partial list. */
export async function reorderChainSteps(
  scope: ChainScope,
  orderedIds: string[],
): Promise<ApiSuccessResponse<Chain>> {
  return api.put(`/approval-chains/${scope}/steps/reorder`, { orderedIds });
}
