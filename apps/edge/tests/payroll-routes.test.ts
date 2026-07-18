import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type {
  MyPayslipRecord,
  PayrollRunRecord,
  PayrollStore,
} from "../src/payroll/store";
import type { RuntimeBindings } from "../src/runtime";

const TEST_TOKEN = "test-token-that-is-long-enough-for-edge-auth";

function testEnv(overrides: Partial<RuntimeBindings> = {}): RuntimeBindings {
  return {
    API_ORIGIN: "https://api.example",
    API_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ENABLE_HYPERDRIVE_BOUNDARY: "false",
    ...overrides,
  } as RuntimeBindings;
}

function hyperdriveEnv(
  overrides: Partial<RuntimeBindings> = {},
): RuntimeBindings {
  return testEnv({
    ENABLE_HYPERDRIVE_BOUNDARY: "true",
    HYPERDRIVE_DATABASE: {
      connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
    } as Hyperdrive,
    ...overrides,
  });
}

const verifyToken = vi.fn(async () => ({
  role: "employee",
  subject: "user-123",
}));

function memoryStore(seed?: {
  runs?: PayrollRunRecord[];
  payslips?: MyPayslipRecord[];
  permissionsByUser?: Record<string, string[]>;
  scopedEmployeeIds?: Record<string, string[]>;
}): PayrollStore {
  const runs = [...(seed?.runs ?? [])];
  const payslips = [...(seed?.payslips ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["payroll:read"],
  };
  const scopedEmployeeIds = seed?.scopedEmployeeIds ?? {
    "run-1": ["user-123"],
    "run-other": ["user-456"],
  };

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findMany(filters, page, limit) {
      let rows = runs.filter((run) =>
        (scopedEmployeeIds[run.id] ?? []).includes(filters.employeeIdScope),
      );
      if (filters.status) {
        rows = rows.filter((run) => run.status === filters.status);
      }
      if (filters.period) {
        rows = rows.filter((run) => run.period === filters.period);
      }
      if (filters.entityId) {
        rows = rows.filter((run) => run.entityId === filters.entityId);
      }
      const total = rows.length;
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total };
    },
    async findPayslipsByEmployeeId(employeeId) {
      // Memory fixture tags employee via payrollRun.entity.name convention:
      // slips are pre-filtered by the seed author for the employee under test.
      void employeeId;
      return payslips;
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("payroll dual-path routes", () => {
  it("proxies /api/payroll/runs when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/payroll/runs");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/payroll/runs",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for payroll when Hyperdrive is flagged on without binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/payroll/runs",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists self-scoped payroll runs and strips sensitive fields", async () => {
    const store = memoryStore({
      runs: [
        {
          id: "run-1",
          period: "2026-07",
          status: "paid",
          totalGross: "10000",
          totalNet: "8000",
          totalTax: "2000",
          createdAt: "2026-07-18T00:00:00.000Z",
          entityId: "entity-1",
          entityName: "Manut TH",
          runnerId: "hr-1",
          runnerName: "HR Runner",
          approverId: "hr-2",
          approverName: "HR Approver",
        },
        {
          id: "run-other",
          period: "2026-07",
          status: "paid",
          totalGross: "99999",
          totalNet: "99999",
          totalTax: "0",
          createdAt: "2026-07-18T00:00:00.000Z",
          entityId: "entity-1",
          entityName: "Manut TH",
          runnerId: "hr-1",
          runnerName: "HR Runner",
          approverId: null,
          approverName: null,
        },
      ],
    });

    const app = createEdgeApp({
      createPayrollStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/payroll/runs",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<Record<string, unknown>>;
      meta: { total: number };
    };
    expect(body.meta.total).toBe(1);
    expect(body.data[0]).toMatchObject({
      id: "run-1",
      period: "2026-07",
      totalNet: "8000",
      runner: { id: "hr-1", name: "HR Runner" },
      approver: { id: "hr-2", name: "HR Approver" },
    });
    expect(body.data[0]).not.toHaveProperty("notes");
    expect(body.data[0]).not.toHaveProperty("currencyTotals");
    expect(
      (body.data[0]?.runner as Record<string, unknown> | undefined)?.email,
    ).toBeUndefined();
  });

  it("lists my-payslips with strict projection on the Hyperdrive path", async () => {
    const store = memoryStore({
      payslips: [
        {
          id: "slip-1",
          baseSalary: "10000",
          grossPay: "12000",
          netPay: "9000",
          currency: "THB",
          hasDocument: true,
          payrollRun: {
            id: "run-1",
            period: "2026-07",
            status: "paid",
            entity: { id: "entity-1", name: "Manut TH" },
          },
        },
      ],
    });
    const app = createEdgeApp({
      createPayrollStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/payroll/my-payslips",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<Record<string, unknown>>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "slip-1",
      netPay: "9000",
      hasDocument: true,
      payrollRun: { period: "2026-07", status: "paid" },
    });
    expect(body.data[0]).not.toHaveProperty("documentUrl");
    expect(body.data[0]).not.toHaveProperty("allowances");
    expect(body.data[0]).not.toHaveProperty("deductions");
    expect(body.data[0]).not.toHaveProperty("baseCurrency");
    expect(body.data[0]).not.toHaveProperty("snapshot");
    expect(JSON.stringify(body)).not.toContain("documentUrl");
  });

  it("proxies manager payroll lists and payslip downloads when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      expect([
        "/api/payroll/runs",
        "/api/payroll/my-payslips/slip-1/download",
      ]).toContain(path);
      return Response.json({ data: [] });
    });
    vi.stubGlobal("fetch", upstream);

    const managerStore = memoryStore({
      permissionsByUser: {
        "user-123": ["payroll:read", "payroll:create"],
      },
    });
    const app = createEdgeApp({
      createPayrollStore: async () => managerStore,
      verifyToken,
    });

    const managerList = await app.request(
      "https://intranet.example/api/payroll/runs",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(managerList.status).toBe(200);

    const download = await app.request(
      "https://intranet.example/api/payroll/my-payslips/slip-1/download",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(download.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
});
