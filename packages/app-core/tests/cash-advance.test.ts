import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  canDeleteCashAdvanceDraft,
  canSubmitCashAdvance,
  createCashAdvance,
  deleteCashAdvance,
  listCashAdvances,
  submitCashAdvance,
} from "../src/cash-advance/cash-advance";

const request = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requestNumber: 42,
  employeeId: "11111111-1111-4111-8111-111111111111",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
    jobTitle: "Coordinator",
  },
  entityId: "entity-1",
  entity: { id: "entity-1", name: "Manut", code: "MNT" },
  requestDate: "2026-07-18",
  position: null,
  department: "Operations",
  directManager: null,
  payoutMode: "cash",
  bankName: null,
  bankCountry: null,
  bankAccountNo: "secret-account",
  swiftCode: null,
  currency: "THB",
  status: "draft",
  currentStepOrder: null,
  approvalChain: [{ order: 1, name: "Manager", status: "pending" }],
  requestedTotal: 1500,
  approvedTotal: 0,
  notes: "internal",
  rejectReason: null,
  submittedAt: null,
  approvedById: null,
  approver: null,
  approvedAt: null,
  disbursedAt: null,
  disbursementProofUrl: "r2://private/proof.pdf",
  clearedAt: null,
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
  items: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      position: 0,
      description: "Field travel float",
      categoryId: null,
      category: null,
      requestedAmount: 1500,
      approvedAmount: 0,
      receiptUrl: "r2://private/receipt.pdf",
    },
  ],
};

describe("cash-advance foundation contracts", () => {
  it("lists projected requests and strips bank, notes, and proof urls", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [request],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listCashAdvances(client, {
      scope: "mine",
      page: 1,
      limit: 20,
    });
    expect(result.data[0]).toEqual({
      id: request.id,
      requestNumber: 42,
      requestDate: "2026-07-18",
      payoutMode: "cash",
      currency: "THB",
      status: "draft",
      requestedTotal: 1500,
      approvedTotal: 0,
      rejectReason: null,
      itemCount: 1,
      employee: {
        id: request.employee.id,
        name: "Person",
        email: "person@manut.example",
      },
      entityName: "Manut",
    });
    expect(result.data[0]).not.toHaveProperty("bankAccountNo");
    expect(result.data[0]).not.toHaveProperty("notes");
    expect(result.data[0]).not.toHaveProperty("disbursementProofUrl");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/cash-advance?"),
      undefined,
    );
    expect(get.mock.calls[0]?.[0]).toContain("scope=mine");
  });

  it("creates a draft, submits, and deletes", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({ data: request })
      .mockResolvedValueOnce({
        data: { ...request, status: "submitted" },
      });
    const del = vi.fn().mockResolvedValue(undefined);
    const client = { post, delete: del } as unknown as ApiClient;

    const created = await createCashAdvance(client, {
      payoutMode: "cash",
      currency: "THB",
      items: [{ description: "Field travel float", requestedAmount: 1500 }],
    });
    expect(created.status).toBe("draft");
    expect(post).toHaveBeenCalledWith("/cash-advance", {
      payoutMode: "cash",
      currency: "THB",
      items: [{ description: "Field travel float", requestedAmount: 1500 }],
    });

    await expect(submitCashAdvance(client, request.id)).resolves.toMatchObject({
      status: "submitted",
    });
    expect(post).toHaveBeenCalledWith(
      `/cash-advance/${request.id}/submit`,
      {},
    );

    await deleteCashAdvance(client, request.id);
    expect(del).toHaveBeenCalledWith(`/cash-advance/${request.id}`);
  });

  it("gates submit/delete helpers by status", () => {
    expect(canSubmitCashAdvance("draft")).toBe(true);
    expect(canSubmitCashAdvance("rejected")).toBe(true);
    expect(canSubmitCashAdvance("submitted")).toBe(false);
    expect(canDeleteCashAdvanceDraft("draft")).toBe(true);
    expect(canDeleteCashAdvanceDraft("rejected")).toBe(false);
  });
});
