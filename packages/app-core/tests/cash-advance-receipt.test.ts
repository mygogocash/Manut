import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getCashAdvanceItemReceiptUrl,
  listCashAdvances,
} from "../src/cash-advance/cash-advance";

const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const request = {
  id: requestId,
  requestNumber: 42,
  employeeId: "11111111-1111-4111-8111-111111111111",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  entity: { id: "entity-1", name: "Manut" },
  requestDate: "2026-07-18",
  payoutMode: "cash",
  currency: "THB",
  status: "submitted",
  requestedTotal: 1500,
  approvedTotal: 0,
  rejectReason: null,
  bankAccountNo: "secret-account",
  notes: "internal",
  disbursementProofUrl: "r2://private/proof.pdf",
  items: [
    {
      id: itemId,
      description: "Field travel float",
      requestedAmount: 1500,
      approvedAmount: 0,
      receiptUrl: "https://files.example/receipts/r1.pdf",
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      description: "Meals",
      requestedAmount: 200,
      approvedAmount: 0,
      receiptUrl: null,
    },
  ],
};

describe("cash-advance receipt contracts", () => {
  it("projects line items with hasReceipt and strips receiptUrl from list", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [request],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listCashAdvances(client, {
      scope: "all",
      page: 1,
      limit: 20,
      status: "submitted",
    });

    expect(result.data[0]?.items).toEqual([
      {
        id: itemId,
        description: "Field travel float",
        requestedAmount: 1500,
        approvedAmount: 0,
        hasReceipt: true,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        description: "Meals",
        requestedAmount: 200,
        approvedAmount: 0,
        hasReceipt: false,
      },
    ]);
    expect(result.data[0]?.items?.[0]).not.toHaveProperty("receiptUrl");
    expect(JSON.stringify(result)).not.toContain("receipts/r1.pdf");
  });

  it("fetches a fresh signed receipt URL for a line item", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: { url: "https://signed.example/receipt.pdf" },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      getCashAdvanceItemReceiptUrl(client, requestId, itemId, signal),
    ).resolves.toEqual({ url: "https://signed.example/receipt.pdf" });
    expect(get).toHaveBeenCalledWith(
      `/cash-advance/${encodeURIComponent(requestId)}/items/${encodeURIComponent(itemId)}/receipt`,
      { signal },
    );
  });
});
