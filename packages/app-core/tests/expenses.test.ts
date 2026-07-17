import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  expenseReportListParamsSchema,
  expenseReportSchema,
  getExpenseReport,
  listExpenseReports,
} from "../src/expenses/expenses";

const report = {
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
};

describe("expenses contracts", () => {
  it("accepts expense report receipts and rejects unknown status values", () => {
    expect(expenseReportSchema.safeParse(report).success).toBe(true);
    expect(
      expenseReportSchema.safeParse({
        ...report,
        status: "pending",
      }).success,
    ).toBe(false);
  });

  it("normalizes list parameters and bounds page size", () => {
    expect(
      expenseReportListParamsSchema.parse({
        page: 2,
        limit: 20,
        employeeId: "11111111-1111-4111-8111-111111111111",
        status: "submitted",
        period: "2026-07",
      }),
    ).toEqual({
      page: 2,
      limit: 20,
      employeeId: "11111111-1111-4111-8111-111111111111",
      status: "submitted",
      period: "2026-07",
    });
    expect(
      expenseReportListParamsSchema.safeParse({ page: 0, limit: 101 }).success,
    ).toBe(false);
    expect(
      expenseReportListParamsSchema.safeParse({ period: "2026-13" }).success,
    ).toBe(false);
  });

  it("lists reports with pagination and forwards aborts", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [report],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listExpenseReports(
        client,
        {
          page: 1,
          limit: 20,
          employeeId: "11111111-1111-4111-8111-111111111111",
        },
        signal,
      ),
    ).resolves.toMatchObject({ data: [report], meta: { total: 1 } });

    expect(get).toHaveBeenCalledWith(
      "/expenses/reports?page=1&limit=20&employeeId=11111111-1111-4111-8111-111111111111",
      { signal },
    );
  });

  it("loads a report detail and strips approval internals", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        ...report,
        notes: "internal finance note",
        canApprove: true,
        approver: {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Manager",
          email: "manager@manut.example",
        },
        expenses: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            description: "Taxi",
            amount: "40",
            currency: "USD",
            date: "2026-07-05",
            status: "pending",
            receiptUrl: "https://private.example/receipt.pdf",
          },
        ],
      },
    });
    const client = { get } as unknown as ApiClient;

    const detail = await getExpenseReport(client, report.id);

    expect(detail).toMatchObject({
      id: report.id,
      title: report.title,
      status: "submitted",
      lineCount: 3,
    });
    expect(detail).not.toHaveProperty("canApprove");
    expect(detail).not.toHaveProperty("notes");
    expect(detail).not.toHaveProperty("expenses");
    expect(get).toHaveBeenCalledWith(
      `/expenses/reports/${report.id}`,
      undefined,
    );
  });
});
