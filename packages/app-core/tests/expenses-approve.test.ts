import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  approveExpenseReport,
  canActOnExpenseReport,
  listExpenseReports,
  rejectExpenseReport,
  rejectExpenseReportInputSchema,
} from "../src/expenses/expenses";

const submittedReport = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  period: "2026-07",
  title: "July travel meals",
  category: "general" as const,
  status: "submitted" as const,
  submittedAt: "2026-07-10T10:00:00.000Z",
  approvedAt: null,
  rejectReason: null,
  reimbursedAt: null,
  totalAmount: 1250.5,
  totalCurrency: "USD",
  converted: true,
  missingRates: [] as string[],
  approvedTotal: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
  entity: { id: "entity-1", name: "Manut Ops" },
  _count: { expenses: 3 },
  notes: "secret",
  canApprove: true,
  approver: { id: "mgr", name: "Mgr", email: "mgr@manut.example" },
};

describe("expenses approve contracts", () => {
  it("lists pendingForMe inbox and strips employee email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [submittedReport],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listExpenseReports(client, {
      pendingForMe: true,
      page: 1,
      limit: 20,
    });

    expect(result.data[0]?.employee).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Person",
    });
    expect(result.data[0]?.employee).not.toHaveProperty("email");
    expect(result.data[0]).not.toHaveProperty("notes");
    expect(result.data[0]).not.toHaveProperty("canApprove");
    expect(get).toHaveBeenCalledWith(
      "/expenses/reports?page=1&limit=20&pendingForMe=true",
      undefined,
    );
  });

  it("approves and rejects submitted reports", async () => {
    expect(canActOnExpenseReport("submitted")).toBe(true);
    expect(canActOnExpenseReport("draft")).toBe(false);
    expect(
      rejectExpenseReportInputSchema.parse({ reason: "  Missing receipt  " }),
    ).toEqual({ reason: "Missing receipt" });

    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...submittedReport, status: "approved" },
      })
      .mockResolvedValueOnce({
        data: { ...submittedReport, status: "rejected" },
      });
    const client = { post } as unknown as ApiClient;

    await expect(
      approveExpenseReport(client, submittedReport.id),
    ).resolves.toMatchObject({
      id: submittedReport.id,
      status: "approved",
    });
    expect(post).toHaveBeenNthCalledWith(
      1,
      `/expenses/reports/${submittedReport.id}/approve`,
      {},
    );

    await expect(
      rejectExpenseReport(client, submittedReport.id, {
        reason: "Missing receipt",
      }),
    ).resolves.toMatchObject({
      id: submittedReport.id,
      status: "rejected",
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/expenses/reports/${submittedReport.id}/reject`,
      { reason: "Missing receipt" },
    );
  });
});
