import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  approvePayrollRun,
  listMyPayslips,
  listPayrollRuns,
} from "../src/payroll/payroll";

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

  it("lists my payslips and strips documentUrl, allowances, and deductions", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "clpayslip00000000000000001",
          baseSalary: "50000",
          grossPay: "52000",
          netPay: "48000",
          currency: "THB",
          documentUrl: "https://storage.example/secret.pdf",
          allowances: { meal: 2000 },
          deductions: { tax: 4000 },
          employeeId: "11111111-1111-4111-8111-111111111111",
          payrollRun: {
            id: run.id,
            period: "2026-06",
            status: "approved",
            entity: { id: run.entity.id, name: "Manut Ops" },
          },
        },
      ],
    });
    const client = { get } as unknown as ApiClient;

    const result = await listMyPayslips(client);
    expect(result.data[0]).toEqual({
      id: "clpayslip00000000000000001",
      baseSalary: "50000",
      grossPay: "52000",
      netPay: "48000",
      currency: "THB",
      hasDocument: true,
      payrollRun: {
        id: run.id,
        period: "2026-06",
        status: "approved",
        entity: { id: run.entity.id, name: "Manut Ops" },
      },
    });
    expect(result.data[0]).not.toHaveProperty("documentUrl");
    expect(result.data[0]).not.toHaveProperty("allowances");
    expect(result.data[0]).not.toHaveProperty("deductions");
    expect(result.data[0]).not.toHaveProperty("employeeId");
    expect(result.data[0]).not.toHaveProperty("grossPayBase");
    expect(result.data[0]).not.toHaveProperty("positionSnapshot");
    expect(get).toHaveBeenCalledWith("/payroll/my-payslips", undefined);
  });

  it("honours edge hasDocument when documentUrl is stripped upstream", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "clpayslip00000000000000002",
          baseSalary: "50000",
          grossPay: "52000",
          netPay: "48000",
          currency: "THB",
          hasDocument: true,
          payrollRun: {
            id: run.id,
            period: "2026-05",
            status: "paid",
            entity: { id: run.entity.id, name: "Manut Ops" },
          },
        },
      ],
    });
    const client = { get } as unknown as ApiClient;

    const result = await listMyPayslips(client);
    expect(result.data[0]?.hasDocument).toBe(true);
    expect(result.data[0]).not.toHaveProperty("documentUrl");
  });

  it("approves a draft payroll run and strips notes and emails", async () => {
    const put = vi.fn().mockResolvedValue({
      data: {
        ...run,
        status: "approved",
        notes: "still secret",
        approver: {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Approver",
          email: "approver@manut.example",
        },
      },
    });
    const client = { put } as unknown as ApiClient;

    const result = await approvePayrollRun(client, run.id);
    expect(result).toEqual({
      id: run.id,
      period: "2026-06",
      status: "approved",
      totalGross: "10000.00",
      totalNet: "8500.00",
      totalTax: "1500.00",
      createdAt: "2026-06-01T00:00:00.000Z",
      entity: { id: run.entity.id, name: "Manut Ops" },
      runner: { id: run.runner.id, name: "Runner" },
      approver: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Approver",
      },
    });
    expect(result).not.toHaveProperty("notes");
    expect(result.approver).not.toHaveProperty("email");
    expect(put).toHaveBeenCalledWith(`/payroll/runs/${run.id}/approve`, {});
  });

  it("rejects empty payroll run ids before calling the API", async () => {
    const put = vi.fn();
    const client = { put } as unknown as ApiClient;

    await expect(approvePayrollRun(client, "")).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});
