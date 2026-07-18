import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  cashAdvanceApprovalStepSchema,
  cashAdvanceApproverTypeLabel,
  listCashAdvanceApprovalSteps,
} from "../src/cash-advance/cash-advance-approval-steps";

const step = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  order: 1,
  name: "Manager",
  description: null,
  approverType: "manager" as const,
  approverUserId: null,
  approverUser: null,
  skipWhenSubmitterIds: ["x"],
  payoutModeFilter: ["cash"],
  isActive: true,
};

describe("cash-advance approval steps contracts", () => {
  it("projects step fields and strips filter allowlists", () => {
    const parsed = cashAdvanceApprovalStepSchema.parse(step);
    expect(parsed).toEqual({
      id: step.id,
      order: 1,
      name: "Manager",
      description: null,
      approverType: "manager",
      approverUserId: null,
      approverUser: null,
      isActive: true,
    });
    expect(parsed).not.toHaveProperty("payoutModeFilter");
    expect(cashAdvanceApproverTypeLabel("user")).toBe("Specific user");
  });

  it("lists approval steps", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [step] });
    const client = { get } as unknown as ApiClient;

    await expect(
      listCashAdvanceApprovalSteps(client, signal),
    ).resolves.toEqual([
      expect.objectContaining({ name: "Manager", order: 1 }),
    ]);
    expect(get).toHaveBeenCalledWith("/cash-advance/approval-steps", {
      signal,
    });
  });
});
