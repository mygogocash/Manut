import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  leaveApprovalStepSchema,
  leaveApproverTypeLabel,
  listLeaveApprovalSteps,
} from "../src/leave/leave-approval-steps";

const step = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  order: 1,
  name: "Manager",
  description: null,
  approverType: "manager" as const,
  approverUserId: null,
  approverUser: null,
  skipWhenSubmitterIds: ["x"],
  onlyWhenSubmitterIds: [],
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("leave approval steps contracts", () => {
  it("projects step fields and strips submitter allowlists", () => {
    const parsed = leaveApprovalStepSchema.parse(step);
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
    expect(parsed).not.toHaveProperty("skipWhenSubmitterIds");
    expect(leaveApproverTypeLabel("user")).toBe("Specific user");
  });

  it("lists approval steps", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [step] });
    const client = { get } as unknown as ApiClient;

    await expect(listLeaveApprovalSteps(client, signal)).resolves.toEqual([
      expect.objectContaining({ name: "Manager", order: 1 }),
    ]);
    expect(get).toHaveBeenCalledWith("/leave/approval-steps", { signal });
  });
});
