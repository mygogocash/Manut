import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  leaveCategoryLabel,
  leavePolicySchema,
  listLeavePolicies,
} from "../src/leave/leave-policies";

const policy = {
  id: "annual-leave",
  entityId: null,
  entity: null,
  name: "Annual leave",
  code: "AL",
  description: "Paid annual leave",
  category: "earned" as const,
  daysPerYear: 12,
  requiresApproval: true,
  isPaid: true,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("leave policies contracts", () => {
  it("projects policy fields and strips timestamps", () => {
    const parsed = leavePolicySchema.parse(policy);
    expect(parsed).toEqual({
      id: policy.id,
      entityId: null,
      entity: null,
      name: "Annual leave",
      code: "AL",
      description: "Paid annual leave",
      category: "earned",
      daysPerYear: 12,
      requiresApproval: true,
      isPaid: true,
      isActive: true,
    });
    expect(parsed).not.toHaveProperty("createdAt");
    expect(leaveCategoryLabel("sick")).toBe("Sick");
  });

  it("lists all leave policies for HR settings", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [policy] });
    const client = { get } as unknown as ApiClient;

    await expect(listLeavePolicies(client, signal)).resolves.toEqual([
      expect.objectContaining({ name: "Annual leave", code: "AL" }),
    ]);
    expect(get).toHaveBeenCalledWith("/leave/types/all", { signal });
  });

  it("forwards an optional entity filter", async () => {
    const get = vi.fn().mockResolvedValue({ data: [] });
    const client = { get } as unknown as ApiClient;

    await listLeavePolicies(client, undefined, { entityId: "global" });
    expect(get).toHaveBeenCalledWith("/leave/types/all?entityId=global", undefined);
  });
});
