import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  addExpenseLine,
  addExpenseLineInputSchema,
  createExpenseReport,
  createExpenseReportInputSchema,
  listExpenseFormEntities,
  submitExpenseReport,
} from "../src/expenses/expenses";

const report = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  period: "2026-07",
  title: "July travel meals",
  category: "general" as const,
  status: "draft" as const,
  submittedAt: null,
  approvedAt: null,
  rejectReason: null,
  reimbursedAt: null,
  totalAmount: 0,
  totalCurrency: "USD",
  converted: true,
  missingRates: [] as string[],
  approvedTotal: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
  entity: { id: "entity-1", name: "Manut Ops" },
  _count: { expenses: 0 },
};

describe("expenses write contracts", () => {
  it("requires entity, period, and title for create", () => {
    expect(
      createExpenseReportInputSchema.safeParse({
        entityId: "",
        period: "2026-07",
        title: "Meals",
      }).success,
    ).toBe(false);
    expect(
      createExpenseReportInputSchema.parse({
        entityId: " entity-1 ",
        period: "2026-07",
        title: " July meals ",
      }),
    ).toMatchObject({
      entityId: "entity-1",
      period: "2026-07",
      title: "July meals",
      category: "general",
    });
  });

  it("creates a draft report", async () => {
    const post = vi.fn().mockResolvedValue({ data: report });
    const client = { post } as unknown as ApiClient;

    await expect(
      createExpenseReport(client, {
        entityId: "entity-1",
        period: "2026-07",
        title: "July meals",
      }),
    ).resolves.toMatchObject({ id: report.id, status: "draft" });
    expect(post).toHaveBeenCalledWith(
      "/expenses/reports",
      expect.objectContaining({
        entityId: "entity-1",
        period: "2026-07",
        title: "July meals",
      }),
    );
  });

  it("adds a line with optional receipt URL and submits the report", async () => {
    expect(
      addExpenseLineInputSchema.safeParse({
        description: "Taxi",
        amount: 0,
        currency: "USD",
        date: "2026-07-05",
      }).success,
    ).toBe(false);

    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          description: "Taxi",
          amount: "40",
          currency: "USD",
          date: "2026-07-05",
          status: "pending",
        },
      })
      .mockResolvedValueOnce({
        data: { ...report, status: "submitted", _count: { expenses: 1 } },
      });
    const client = { post } as unknown as ApiClient;

    await expect(
      addExpenseLine(client, report.id, {
        description: " Taxi ",
        amount: 40,
        currency: "usd",
        date: "2026-07-05",
        receiptUrl: "https://files.example/taxi.pdf",
      }),
    ).resolves.toMatchObject({ description: "Taxi", amount: "40" });

    await expect(submitExpenseReport(client, report.id)).resolves.toMatchObject(
      { status: "submitted" },
    );

    expect(post).toHaveBeenNthCalledWith(
      1,
      `/expenses/reports/${report.id}/expenses`,
      expect.objectContaining({
        description: "Taxi",
        amount: 40,
        currency: "USD",
        receiptUrl: "https://files.example/taxi.pdf",
      }),
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/expenses/reports/${report.id}/submit`,
      {},
    );
  });

  it("lists form entities for report create", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [{ id: "entity-1", name: "Manut Ops" }],
    });
    const client = { get } as unknown as ApiClient;

    await expect(listExpenseFormEntities(client)).resolves.toEqual([
      { id: "entity-1", name: "Manut Ops" },
    ]);
    expect(get).toHaveBeenCalledWith("/expenses/meta/entities", undefined);
  });
});
