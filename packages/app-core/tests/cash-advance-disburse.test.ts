import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  canClearCashAdvance,
  canDisburseCashAdvance,
  clearCashAdvance,
  disburseCashAdvance,
  disburseCashAdvanceInputSchema,
} from "../src/cash-advance/cash-advance";

const approved = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requestNumber: 42,
  requestDate: "2026-07-18",
  payoutMode: "cash",
  currency: "THB",
  status: "approved",
  requestedTotal: 1500,
  approvedTotal: 1500,
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
  disbursementProofUrl: "https://files.example/proof.pdf",
};

describe("cash-advance disburse contracts", () => {
  it("gates disburse and clear by status", () => {
    expect(canDisburseCashAdvance("approved")).toBe(true);
    expect(canDisburseCashAdvance("submitted")).toBe(false);
    expect(canDisburseCashAdvance("disbursed")).toBe(false);
    expect(canClearCashAdvance("disbursed")).toBe(true);
    expect(canClearCashAdvance("approved")).toBe(false);
    expect(canClearCashAdvance("cleared")).toBe(false);
  });

  it("requires a proof URL before disburse", () => {
    expect(
      disburseCashAdvanceInputSchema.parse({
        proofUrl: "  https://files.example/slip.pdf  ",
      }),
    ).toEqual({ proofUrl: "https://files.example/slip.pdf" });
    expect(() =>
      disburseCashAdvanceInputSchema.parse({ proofUrl: "not-a-url" }),
    ).toThrow();
  });

  it("disburses and clears without echoing proof URLs", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          ...approved,
          status: "disbursed",
          disbursementProofUrl: "https://files.example/proof.pdf",
        },
      })
      .mockResolvedValueOnce({
        data: {
          ...approved,
          status: "cleared",
          disbursementProofUrl: "https://files.example/proof.pdf",
        },
      });
    const client = { post } as unknown as ApiClient;

    const disbursed = await disburseCashAdvance(client, approved.id, {
      proofUrl: "https://files.example/slip.pdf",
    });
    expect(disbursed).toMatchObject({
      id: approved.id,
      status: "disbursed",
      employee: { id: approved.employee.id, name: "Person" },
    });
    expect(disbursed).not.toHaveProperty("disbursementProofUrl");
    expect(post).toHaveBeenNthCalledWith(
      1,
      `/cash-advance/${approved.id}/disburse`,
      { proofUrl: "https://files.example/slip.pdf" },
    );

    const cleared = await clearCashAdvance(client, approved.id);
    expect(cleared).toMatchObject({
      id: approved.id,
      status: "cleared",
    });
    expect(cleared).not.toHaveProperty("disbursementProofUrl");
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/cash-advance/${approved.id}/clear`,
      {},
    );
  });
});
