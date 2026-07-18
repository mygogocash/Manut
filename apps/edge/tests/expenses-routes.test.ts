import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ExpenseApprovalDecisionRecord,
  ExpenseApprovalStepRecord,
  ExpenseLineRecord,
  ExpenseReportRecord,
  ExpensesStore,
} from "../src/expenses/store";
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

function baseReport(
  overrides: Partial<ExpenseReportRecord> & Pick<ExpenseReportRecord, "id">,
): ExpenseReportRecord {
  return {
    period: "2026-07",
    title: "July",
    category: "general",
    status: "draft",
    currentStepOrder: null,
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
    ...overrides,
  };
}

function memoryStore(seed?: {
  reports?: ExpenseReportRecord[];
  lines?: ExpenseLineRecord[];
  permissionsByUser?: Record<string, string[]>;
  registeredUploads?: Array<{
    id: string;
    bucket: string;
    path: string;
    purpose: string;
    uploadedBy: string;
  }>;
  approvalSteps?: ExpenseApprovalStepRecord[];
  decisionsByReport?: Record<string, ExpenseApprovalDecisionRecord[]>;
  pendingForMeIds?: string[];
  reportingToByUser?: Record<string, string | null>;
  exchangeRates?: Array<{
    baseCurrency: string;
    currency: string;
    rate: number;
  }>;
  categoryAllowance?: Record<string, boolean>;
}): ExpensesStore {
  const reports = [...(seed?.reports ?? [])];
  const lines = [...(seed?.lines ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["expense:read", "expense:create"],
  };
  const registeredUploads = [...(seed?.registeredUploads ?? [])];
  const approvalSteps = [...(seed?.approvalSteps ?? [])];
  const decisionsByReport: Record<string, ExpenseApprovalDecisionRecord[]> = {
    ...(seed?.decisionsByReport ?? {}),
  };
  const pendingForMeIds = [...(seed?.pendingForMeIds ?? [])];
  const reportingToByUser = seed?.reportingToByUser ?? {};
  const exchangeRates = [...(seed?.exchangeRates ?? [])];
  const categoryAllowance = seed?.categoryAllowance ?? {};

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findRegistered(query) {
      const match = registeredUploads.find(
        (upload) =>
          upload.bucket === query.bucket &&
          upload.path === query.path &&
          upload.purpose === query.purpose &&
          (query.uploadedBy === undefined ||
            upload.uploadedBy === query.uploadedBy),
      );
      return match ? { id: match.id } : null;
    },
    async findMany(filters, page, limit) {
      let rows = [...reports];
      if (filters.employeeId) {
        rows = rows.filter((report) => report.employeeId === filters.employeeId);
      }
      if (filters.reportIds) {
        const ids = new Set(filters.reportIds);
        rows = rows.filter((report) => ids.has(report.id));
      }
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
      const row = baseReport({
        id: `report-${reports.length + 1}`,
        period: input.period,
        title: input.title,
        category: input.category,
        employeeId: input.employeeId,
        entityId: input.entityId,
      });
      reports.push(row);
      return row;
    },
    async findCategoryById(id) {
      if (!(id in categoryAllowance) && Object.keys(categoryAllowance).length === 0) {
        return null;
      }
      return {
        id,
        name: "Category",
        receiptRequired: false,
        spendingLimit: null,
        isAllowance: categoryAllowance[id] ?? false,
      };
    },
    async findLineById(id) {
      return lines.find((line) => line.id === id) ?? null;
    },
    async findLinesForReport(reportId) {
      return lines
        .filter((line) => line.reportId === reportId)
        .map((line) => ({
          id: line.id,
          amount: Number(line.amount),
          currency: line.currency,
          date: line.date,
          categoryId: line.categoryId,
        }));
    },
    async addLine(input) {
      const row: ExpenseLineRecord = {
        id: `line-${lines.length + 1}`,
        reportId: input.reportId,
        employeeId: input.employeeId,
        description: input.description,
        amount: String(input.amount),
        currency: input.currency,
        date: input.date,
        status: "pending",
        categoryId: input.categoryId ?? null,
        notes: input.notes ?? null,
        receiptUrl: input.receiptUrl ?? null,
      };
      lines.push(row);
      const report = reports.find((item) => item.id === input.reportId);
      if (report) {
        report.expenseCount += 1;
        report.totalAmount += input.amount;
      }
      return row;
    },
    async updateLine(id, input) {
      const row = lines.find((line) => line.id === id);
      if (!row) throw new Error("missing");
      if (input.description !== undefined) row.description = input.description;
      if (input.amount !== undefined) row.amount = String(input.amount);
      if (input.currency !== undefined) row.currency = input.currency;
      if (input.date !== undefined) row.date = input.date;
      if (input.categoryId !== undefined) row.categoryId = input.categoryId;
      if (input.notes !== undefined) row.notes = input.notes;
      if (input.receiptUrl !== undefined) row.receiptUrl = input.receiptUrl;
      return row;
    },
    async softDeleteLine(id) {
      const index = lines.findIndex((line) => line.id === id);
      if (index >= 0) {
        const [removed] = lines.splice(index, 1);
        const report = reports.find((item) => item.id === removed?.reportId);
        if (report && report.expenseCount > 0) report.expenseCount -= 1;
      }
    },
    async findPendingForMeReportIds() {
      return pendingForMeIds;
    },
    async findActiveApprovalSteps() {
      return approvalSteps;
    },
    async findDecisions(reportId) {
      return [...(decisionsByReport[reportId] ?? [])];
    },
    async findManagerChain(userId) {
      const l1 = reportingToByUser[userId] ?? null;
      const l2 = l1 ? (reportingToByUser[l1] ?? null) : null;
      return { l1UserId: l1, l2UserId: l2 };
    },
    async findEmployeeReportingTo(employeeId) {
      return reportingToByUser[employeeId] ?? null;
    },
    async findCategoriesAllowance(categoryIds) {
      return categoryIds.map((id) => ({
        id,
        isAllowance: categoryAllowance[id] ?? false,
      }));
    },
    async findExchangeRate(baseCurrency, currency) {
      const match = exchangeRates.find(
        (rate) =>
          rate.baseCurrency === baseCurrency && rate.currency === currency,
      );
      return match?.rate ?? null;
    },
    async snapshotDecisions(id, rows) {
      decisionsByReport[id] = rows.map((row, index) => ({
        id: `decision-${id}-${index + 1}`,
        order: row.order,
        name: row.name,
        approverType: row.approverType,
        approverUserId: row.approverUserId,
        status: "pending",
        approvedAmount: null,
      }));
      const report = reports.find((item) => item.id === id);
      if (report) report.currentStepOrder = 1;
    },
    async submitWithDecisions(id, rows, opts) {
      await this.snapshotDecisions(id, rows);
      const report = reports.find((item) => item.id === id);
      if (!report) throw new Error("missing");
      report.status = "submitted";
      report.submittedAt = "2026-07-18T12:00:00.000Z";
      report.rejectReason = null;
      report.currentStepOrder = 1;
      if (opts?.category) report.category = opts.category;
      return report;
    },
    async finaliseAllowance(id, actorId) {
      const report = reports.find((item) => item.id === id);
      if (!report) throw new Error("missing");
      report.status = "reimbursed";
      report.submittedAt = "2026-07-18T12:00:00.000Z";
      report.approvedAt = "2026-07-18T12:00:00.000Z";
      report.reimbursedAt = "2026-07-18T12:00:00.000Z";
      report.currentStepOrder = null;
      void actorId;
      return report;
    },
    async approveStep(input) {
      const decisions = decisionsByReport[input.reportId] ?? [];
      const decision = decisions.find((row) => row.id === input.decisionId);
      if (decision) {
        decision.status = "approved";
        decision.approvedAmount = input.approvedAmount;
      }
      const report = reports.find((item) => item.id === input.reportId);
      if (!report) throw new Error("missing");
      report.status = input.isFinalStep ? "approved" : "submitted";
      report.currentStepOrder = input.nextStepOrder;
      if (input.isFinalStep) {
        report.approvedAt = "2026-07-18T13:00:00.000Z";
        report.approvedTotal = input.finalApprovedTotal;
      }
      return report;
    },
    async rejectStep(input) {
      if (input.decisionId) {
        const decisions = decisionsByReport[input.reportId] ?? [];
        const decision = decisions.find((row) => row.id === input.decisionId);
        if (decision) decision.status = "rejected";
      }
      const report = reports.find((item) => item.id === input.reportId);
      if (!report) throw new Error("missing");
      report.status = "rejected";
      report.rejectReason = input.reason;
      report.approvedAt = "2026-07-18T13:00:00.000Z";
      report.currentStepOrder = null;
      return report;
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
          currentStepOrder: null,
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
          currentStepOrder: null,
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
    const employee =
      (body.data[0]?.employee as Record<string, unknown> | undefined) ?? {};
    expect(employee).not.toHaveProperty("email");
    expect(employee).not.toHaveProperty("department");
    expect(JSON.stringify(body)).not.toContain("user@example.com");
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

  it("lists pendingForMe reports on the Hyperdrive path", async () => {
    const store = memoryStore({
      reports: [
        baseReport({
          id: "report-pending",
          title: "Needs approval",
          status: "submitted",
          currentStepOrder: 1,
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
        }),
      ],
      pendingForMeIds: ["report-pending"],
      permissionsByUser: {
        "user-123": ["expense:read", "expense:create"],
      },
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports?pendingForMe=true",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "report-pending", title: "Needs approval" }],
      meta: { total: 1 },
    });
  });

  it("proxies includeAll expense lists when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe("/api/expenses/reports");
      expect(url.searchParams.get("includeAll")).toBe("true");
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
      "https://intranet.example/api/expenses/reports?includeAll=true",
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
          currentStepOrder: null,
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

  it("adds and deletes own draft expense lines on the Hyperdrive path", async () => {
    const store = memoryStore({
      reports: [
        {
          id: "report-own",
          period: "2026-07",
          title: "July",
          category: "general",
          status: "draft",
          currentStepOrder: null,
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
      ],
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });

    const addResponse = await app.request(
      "https://intranet.example/api/expenses/reports/report-own/expenses",
      {
        body: JSON.stringify({
          description: "Taxi",
          amount: 120,
          currency: "THB",
          date: "2026-07-18",
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(addResponse.status).toBe(201);
    await expect(addResponse.json()).resolves.toMatchObject({
      data: {
        description: "Taxi",
        amount: "120",
        currency: "THB",
        status: "pending",
      },
    });

    const deleteResponse = await app.request(
      "https://intranet.example/api/expenses/reports/report-own/expenses/line-1",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "DELETE",
      },
      hyperdriveEnv(),
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      data: { success: true },
    });
  });

  it("accepts external receipt URLs on Hyperdrive without TRUSTED_STORAGE_ORIGINS", async () => {
    const store = memoryStore({
      reports: [
        {
          id: "report-own",
          period: "2026-07",
          title: "July",
          category: "general",
          status: "draft",
          currentStepOrder: null,
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
      ],
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-own/expenses",
      {
        body: JSON.stringify({
          description: "Taxi",
          amount: 120,
          currency: "THB",
          date: "2026-07-18",
          receiptUrl: "https://drive.example/file/abc",
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
        description: "Taxi",
        receiptUrl: "https://drive.example/file/abc",
      },
    });
  });

  it("proxies managed receipt expense lines when TRUSTED_STORAGE_ORIGINS is unset", async () => {
    const upstream = vi.fn(async () =>
      Response.json({ data: { id: "proxied-line" } }, { status: 201 }),
    );
    vi.stubGlobal("fetch", upstream);

    const store = memoryStore({
      reports: [
        {
          id: "report-own",
          period: "2026-07",
          title: "July",
          category: "general",
          status: "draft",
          currentStepOrder: null,
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
      ],
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-own/expenses",
      {
        body: JSON.stringify({
          description: "Taxi",
          amount: 120,
          currency: "THB",
          date: "2026-07-18",
          receiptUrl:
            "https://files.manut.example/storage/v1/object/public/receipts/u/r.pdf",
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
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("creates expense line with registered managed receipt when origins are set", async () => {
    const receiptUrl =
      "https://files.manut.example/storage/v1/object/public/receipts/user-123/e1.pdf";
    const store = memoryStore({
      reports: [
        {
          id: "report-own",
          period: "2026-07",
          title: "July",
          category: "general",
          status: "draft",
          currentStepOrder: null,
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
      ],
      registeredUploads: [
        {
          id: "upload-e1",
          bucket: "receipts",
          path: "user-123/e1.pdf",
          purpose: "expense-receipt",
          uploadedBy: "user-123",
        },
      ],
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-own/expenses",
      {
        body: JSON.stringify({
          description: "Taxi",
          amount: 120,
          currency: "THB",
          date: "2026-07-18",
          receiptUrl,
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv({
        TRUSTED_STORAGE_ORIGINS: "https://files.manut.example",
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: { description: "Taxi", receiptUrl },
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
        baseReport({
          id: "report-other",
          title: "Other",
          status: "submitted",
          currentStepOrder: 1,
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
          employeeDepartment: null,
        }),
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

  it("converts amounts on the Hyperdrive FX path", async () => {
    const store = memoryStore({
      exchangeRates: [{ baseCurrency: "USD", currency: "THB", rate: 36 }],
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/convert?amount=10&fromCurrency=USD&toCurrency=THB",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { converted: 360, rate: 36 },
    });
  });

  it("submits own draft expense report on the Hyperdrive path", async () => {
    const store = memoryStore({
      reports: [
        baseReport({
          id: "report-own",
          expenseCount: 1,
          totalAmount: 120,
        }),
      ],
      lines: [
        {
          id: "line-1",
          reportId: "report-own",
          employeeId: "user-123",
          description: "Taxi",
          amount: "120",
          currency: "THB",
          date: "2026-07-18",
          status: "pending",
          categoryId: null,
          notes: null,
          receiptUrl: null,
        },
      ],
      reportingToByUser: { "user-123": "manager-1" },
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-own/submit",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "report-own", status: "submitted" },
    });
  });

  it("approves a submitted report as the direct manager on Hyperdrive", async () => {
    const store = memoryStore({
      reports: [
        baseReport({
          id: "report-team",
          title: "Team spend",
          status: "submitted",
          currentStepOrder: 1,
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
          expenseCount: 1,
          totalAmount: 50,
        }),
      ],
      decisionsByReport: {
        "report-team": [
          {
            id: "decision-1",
            order: 1,
            name: "Manager approval",
            approverType: "manager",
            approverUserId: null,
            status: "pending",
            approvedAmount: null,
          },
        ],
      },
      reportingToByUser: { "user-456": "user-123" },
      permissionsByUser: {
        "user-123": ["expense:read"],
      },
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-team/approve",
      {
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
        body: "{}",
      },
      hyperdriveEnv(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "report-team", status: "approved" },
    });
  });

  it("rejects a submitted report with a reason on Hyperdrive", async () => {
    const store = memoryStore({
      reports: [
        baseReport({
          id: "report-team",
          status: "submitted",
          currentStepOrder: 1,
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
          expenseCount: 1,
          totalAmount: 50,
        }),
      ],
      decisionsByReport: {
        "report-team": [
          {
            id: "decision-1",
            order: 1,
            name: "Manager approval",
            approverType: "manager",
            approverUserId: null,
            status: "pending",
            approvedAmount: null,
          },
        ],
      },
      reportingToByUser: { "user-456": "user-123" },
      permissionsByUser: {
        "user-123": ["expense:read", "expense:hr-approve"],
      },
    });
    const app = createEdgeApp({
      createExpensesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/expenses/reports/report-team/reject",
      {
        body: JSON.stringify({ reason: "Missing receipt" }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "report-team",
        status: "rejected",
        rejectReason: "Missing receipt",
      },
    });
  });
});
