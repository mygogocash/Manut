import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listPayrollRuns } from "../src/payroll/payroll";

const run = {
  id: "clpayrollrun00000000000001",
  entityId: "clentity00000000000000001",
  period: "2026-06",
  status: "draft",
  totalGross: "10000.00",
  totalNet: "8500.00",
  totalTax: "1500.00",
  currencyTotals: {
    THB: { gross: 10000, tax: 1500, net: 8500, count: 2 },
  },
  notes: "internal hr notes",
  runBy: "11111111-1111-4111-8111-111111111111",
  approvedBy: null,
  approvedAt: null,
  paidAt: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  entity: {
    id: "clentity00000000000000001",
    name: "Manut Ops",
    currency: "THB",
  },
  runner: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Runner",
    email: "runner@manut.example",
  },
  approver: null,
};

describe("payroll foundation contracts", () => {
  it("lists projected payroll runs and strips notes, emails, and currency totals", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [run],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listPayrollRuns(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: run.id,
      period: "2026-06",
      status: "draft",
      totalGross: "10000.00",
      totalNet: "8500.00",
      totalTax: "1500.00",
      createdAt: "2026-06-01T00:00:00.000Z",
      entity: { id: run.entity.id, name: "Manut Ops" },
      runner: { id: run.runner.id, name: "Runner" },
      approver: null,
    });
    expect(result.data[0]).not.toHaveProperty("notes");
    expect(result.data[0]).not.toHaveProperty("currencyTotals");
    expect(result.data[0].runner).not.toHaveProperty("email");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/payroll/runs?"),
      undefined,
    );
  });

  it("forwards optional status and period filters", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const client = { get } as unknown as ApiClient;

    await listPayrollRuns(client, {
      page: 2,
      limit: 10,
      status: "approved",
      period: "2026-05",
    });
    expect(get).toHaveBeenCalledWith(
      "/payroll/runs?page=2&limit=10&status=approved&period=2026-05",
      undefined,
    );
  });
});
