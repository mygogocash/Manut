import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listTravelApprovalSteps,
  travelApprovalStepSchema,
  travelApproverTypeLabel,
} from "../src/travel/travel-approval-steps";

const step = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  order: 1,
  name: "Manager",
  description: null,
  approverType: "manager" as const,
  approverUserId: null,
  approverUser: null,
  skipWhenSubmitterIds: ["x"],
  onlyWhenSubmitterIds: [],
  categoryFilter: ["general"],
  amountMinBaht: "100",
  amountMaxBaht: null,
  isActive: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("travel approval steps contracts", () => {
  it("projects step fields and strips filter bands", () => {
    const parsed = travelApprovalStepSchema.parse(step);
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
    expect(parsed).not.toHaveProperty("categoryFilter");
    expect(parsed).not.toHaveProperty("amountMinBaht");
    expect(travelApproverTypeLabel("manager_l2")).toBe("Second-level manager");
    expect(travelApproverTypeLabel("user")).toBe("Specific user");
  });

  it("lists approval steps", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [step] });
    const client = { get } as unknown as ApiClient;

    await expect(listTravelApprovalSteps(client, signal)).resolves.toEqual([
      expect.objectContaining({ name: "Manager", order: 1 }),
    ]);
    expect(get).toHaveBeenCalledWith("/travel/approval-steps", { signal });
  });
});
