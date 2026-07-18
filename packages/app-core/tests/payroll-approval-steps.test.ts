import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listPayrollApprovalSteps,
  payrollApprovalStepSchema,
} from "../src/payroll/payroll-approval-steps";

const step = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  order: 1,
  name: "Finance lead",
  description: "Signs off payroll runs",
  approverUserId: "11111111-1111-4111-8111-111111111111",
  approverUser: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Finance Lead",
    email: "finance@manut.example",
    jobTitle: "Controller",
  },
  isActive: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("payroll approval steps contracts", () => {
  it("projects step fields and strips timestamps", () => {
    const parsed = payrollApprovalStepSchema.parse(step);
    expect(parsed).toEqual({
      id: step.id,
      order: 1,
      name: "Finance lead",
      description: "Signs off payroll runs",
      approverUserId: step.approverUserId,
      approverUser: {
        id: step.approverUser.id,
        name: "Finance Lead",
        email: "finance@manut.example",
      },
      isActive: true,
    });
    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed.approverUser).not.toHaveProperty("jobTitle");
  });

  it("lists approval steps", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [step] });
    const client = { get } as unknown as ApiClient;

    await expect(listPayrollApprovalSteps(client, signal)).resolves.toEqual([
      expect.objectContaining({ name: "Finance lead", order: 1 }),
    ]);
    expect(get).toHaveBeenCalledWith("/payroll/approval-chain/steps", {
      signal,
    });
  });
});
