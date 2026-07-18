import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  approveCashAdvance,
  canActOnCashAdvance,
  listCashAdvances,
  rejectCashAdvance,
  rejectCashAdvanceInputSchema,
} from "../src/cash-advance/cash-advance";

const submitted = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requestNumber: 42,
  requestDate: "2026-07-18",
  payoutMode: "cash",
  currency: "THB",
  status: "submitted",
  requestedTotal: 1500,
  approvedTotal: 0,
  rejectReason: null,
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  entity: { id: "entity-1", name: "Manut" },
  items: [{ id: "item-1", description: "Field travel float" }],
  notes: "internal",
  bankAccountNo: "secret",
};

describe("cash-advance approve contracts", () => {
  it("lists submitted scope=all and strips employee email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [submitted],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listCashAdvances(client, {
      scope: "all",
      status: "submitted",
      page: 1,
      limit: 20,
    });

    expect(result.data[0]?.employee).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Person",
    });
    expect(result.data[0]?.employee).not.toHaveProperty("email");
    expect(get.mock.calls[0]?.[0]).toContain("scope=all");
    expect(get.mock.calls[0]?.[0]).toContain("status=submitted");
  });

  it("approves and rejects submitted requests", async () => {
    expect(canActOnCashAdvance("submitted")).toBe(true);
    expect(canActOnCashAdvance("draft")).toBe(false);
    expect(
      rejectCashAdvanceInputSchema.parse({ reason: "  Over budget  " }),
    ).toEqual({ reason: "Over budget" });

    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...submitted, status: "approved", approvedTotal: 1500 },
      })
      .mockResolvedValueOnce({
        data: { ...submitted, status: "rejected", rejectReason: "Over budget" },
      });
    const client = { post } as unknown as ApiClient;

    await expect(approveCashAdvance(client, submitted.id)).resolves.toMatchObject(
      {
        id: submitted.id,
        status: "approved",
        employee: { id: submitted.employee.id, name: "Person" },
      },
    );
    expect(post).toHaveBeenNthCalledWith(
      1,
      `/cash-advance/${submitted.id}/approve`,
      {},
    );

    await expect(
      rejectCashAdvance(client, submitted.id, { reason: "Over budget" }),
    ).resolves.toMatchObject({
      id: submitted.id,
      status: "rejected",
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/cash-advance/${submitted.id}/reject`,
      { reason: "Over budget" },
    );
  });
});
