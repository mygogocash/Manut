import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  expenseApprovalStepSchema,
  expenseApproverTypeLabel,
  listExpenseApprovalSteps,
} from "../src/expenses/expense-approval-steps";

const step = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  order: 1,
  name: "Manager",
  description: null,
  approverType: "manager" as const,
  approverUserId: null,
  approverUser: null,
  skipWhenSubmitterIds: ["x"],
  categoryFilter: ["general"],
  isActive: true,
};

describe("expense approval steps contracts", () => {
  it("projects step fields and strips filter allowlists", () => {
    const parsed = expenseApprovalStepSchema.parse(step);
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
    expect(expenseApproverTypeLabel("user")).toBe("Specific user");
  });

  it("lists approval steps", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [step] });
    const client = { get } as unknown as ApiClient;

    await expect(listExpenseApprovalSteps(client, signal)).resolves.toEqual([
      expect.objectContaining({ name: "Manager", order: 1 }),
    ]);
    expect(get).toHaveBeenCalledWith("/expenses/approval-steps", { signal });
  });
});
