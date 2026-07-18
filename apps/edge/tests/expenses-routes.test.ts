import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExpenseReportRecord, ExpensesStore } from "../src/expenses/store";
import { createEdgeApp } from "../src/index";
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
  reports?: ExpenseReportRecord[];
  permissionsByUser?: Record<string, string[]>;
}): ExpensesStore {
  const reports = [...(seed?.reports ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["expense:read", "expense:create"],
  };

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findMany(filters, page, limit) {
      let rows = reports.filter(
        (report) => report.employeeId === filters.employeeId,
      );
      if (filters.status) {
        rows = rows.filter((report) => report.status === filters.status);
      }
      if (filters.period) {
        rows = rows.filter((report) => report.period === filters.period);
      }
      const total = rows.length;
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total };
    },
    async findById(id) {
      return reports.find((report) => report.id === id) ?? null;
    },
    async create(input) {
      const now = "2026-07-18T00:00:00.000Z";
      const row: ExpenseReportRecord = {
        id: `report-${reports.length + 1}`,
        period: input.period,
        title: input.title,
        category: input.category,
        status: "draft",
        submittedAt: null,
        approvedAt: null,
        rejectReason: null,
        reimbursedAt: null,
        approvedTotal: null,
        createdAt: now,
        updatedAt: now,
        employeeId: input.employeeId,
        employeeName: "Test User",
        employeeEmail: "user@example.com",
        employeeDepartment: "Eng",
        entityId: input.entityId,
        entityName: "Manut TH",
        expenseCount: 0,
        totalAmount: 0,
        totalCurrency: "THB",
        converted: true,
        missingRates: [],
      };
      reports.push(row);
      return row;
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("expenses dual-path routes", () => {
  it("proxies /api/expenses/reports when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/expenses/reports");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for expenses when Hyperdrive is flagged on without binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists own expense reports on the Hyperdrive path", async () => {
    const store = memoryStore({
      reports: [
        {
          id: "report-own",
          period: "2026-07",
          title: "July",
          category: "general",
          status: "draft",
          submittedAt: null,
          approvedAt: null,
          rejectReason: null,
          reimbursedAt: null,
          approvedTotal: null,
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
          employeeId: "user-123",
          employeeName: "Test User",
          employeeEmail: "user@example.com",
          employeeDepartment: "Eng",
          entityId: "entity-1",
          entityName: "Manut TH",
          expenseCount: 0,
          totalAmount: 0,
          totalCurrency: "THB",
          converted: true,
          missingRates: [],
        },
        {
          id: "report-other",
          period: "2026-07",
          title: "Other",
          category: "general",
          status: "draft",
          submittedAt: null,
          approvedAt: null,
          rejectReason: null,
          reimbursedAt: null,
          approvedTotal: null,
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
          employeeDepartment: null,
          entityId: "entity-1",
          entityName: "Manut TH",
          expenseCount: 0,
          totalAmount: 0,
          totalCurrency: "THB",
          converted: true,
          missingRates: [],
        },
      ],
    });

    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports",
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
      id: "report-own",
      title: "July",
      employee: { id: "user-123", name: "Test User" },
    });
  });

  it("creates an expense report on the Hyperdrive path", async () => {
    const store = memoryStore();
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports",
      {
        body: JSON.stringify({
          entityId: "entity-1",
          period: "2026-07",
          title: "Travel July",
          category: "general",
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        title: "Travel July",
        period: "2026-07",
        status: "draft",
        totalAmount: 0,
      },
    });
  });

  it("proxies pendingForMe and submit leftovers when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe("/api/expenses/reports");
      expect(url.searchParams.get("pendingForMe")).toBe("true");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createExpensesStore: async () => memoryStore(),
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports?pendingForMe=true",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("returns own expense report detail on the Hyperdrive path", async () => {
    const store = memoryStore({
      reports: [
        {
          id: "report-own",
          period: "2026-07",
          title: "July",
          category: "general",
          status: "draft",
          submittedAt: null,
          approvedAt: null,
          rejectReason: null,
          reimbursedAt: null,
          approvedTotal: null,
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
          employeeId: "user-123",
          employeeName: "Test User",
          employeeEmail: "user@example.com",
          employeeDepartment: "Eng",
          entityId: "entity-1",
          entityName: "Manut TH",
          expenseCount: 2,
          totalAmount: 100,
          totalCurrency: "THB",
          converted: true,
          missingRates: [],
        },
      ],
    });

    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-own",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "report-own",
        title: "July",
        _count: { expenses: 2 },
      },
    });
  });

  it("proxies non-self expense report detail when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe(
        "/api/expenses/reports/report-other",
      );
      return Response.json({ data: { id: "report-other" } });
    });
    vi.stubGlobal("fetch", upstream);

    const store = memoryStore({
      reports: [
        {
          id: "report-other",
          period: "2026-07",
          title: "Other",
          category: "general",
          status: "submitted",
          submittedAt: null,
          approvedAt: null,
          rejectReason: null,
          reimbursedAt: null,
          approvedTotal: null,
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
          employeeDepartment: null,
          entityId: "entity-1",
          entityName: "Manut TH",
          expenseCount: 0,
          totalAmount: 0,
          totalCurrency: "THB",
          converted: true,
          missingRates: [],
        },
      ],
    });

    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-other",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });
});
