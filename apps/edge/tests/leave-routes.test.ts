import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type {
  LeaveApprovalDecisionRecord,
  LeaveApprovalStepRecord,
  LeaveBalanceRecord,
  LeavePolicyApproverRecord,
  LeaveRequestDetailRecord,
  LeaveRequestRecord,
  LeaveStore,
  LeaveTypeRecord,
  LeaveUserRecord,
} from "../src/leave/store";
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
  requests?: LeaveRequestRecord[];
  permissionsByUser?: Record<string, string[]>;
  leaveTypes?: LeaveTypeRecord[];
  users?: LeaveUserRecord[];
  balances?: LeaveBalanceRecord[];
  approvalSteps?: LeaveApprovalStepRecord[];
  decisions?: LeaveApprovalDecisionRecord[];
  policyApprovers?: Record<string, LeavePolicyApproverRecord[]>;
  requestMeta?: Record<
    string,
    {
      currentStepOrder: number | null;
      delegatedToId: string | null;
      source: "entitled" | "carried";
      leaveTypeDaysPerYear: number;
    }
  >;
}): LeaveStore {
  const requests = [...(seed?.requests ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["leave:read", "leave:request"],
  };
  const leaveTypes = [...(seed?.leaveTypes ?? [])];
  const users = [
    ...(seed?.users ?? [
      {
        id: "user-123",
        entityId: "entity-1",
        isActive: true,
        reportingTo: null,
      },
    ]),
  ];
  const balances = [...(seed?.balances ?? [])];
  const approvalSteps = [...(seed?.approvalSteps ?? [])];
  const decisions = [...(seed?.decisions ?? [])];
  const policyApprovers = seed?.policyApprovers ?? {};
  const requestMeta: Record<
    string,
    {
      currentStepOrder: number | null;
      delegatedToId: string | null;
      source: "entitled" | "carried";
      leaveTypeDaysPerYear: number;
    }
  > = { ...(seed?.requestMeta ?? {}) };

  function detailFor(request: LeaveRequestRecord): LeaveRequestDetailRecord {
    const meta = requestMeta[request.id] ?? {
      currentStepOrder: null,
      delegatedToId: null,
      source: "entitled" as const,
      leaveTypeDaysPerYear: 12,
    };
    const employee = users.find((user) => user.id === request.employeeId);
    return {
      ...request,
      currentStepOrder: meta.currentStepOrder,
      delegatedToId: meta.delegatedToId,
      source: meta.source,
      leaveTypeDaysPerYear: meta.leaveTypeDaysPerYear,
      employeeReportingTo: employee?.reportingTo ?? null,
    };
  }

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findMany(filters, page, limit) {
      let rows = requests.filter(
        (request) => request.employeeId === filters.employeeId,
      );
      if (filters.status) {
        rows = rows.filter((request) => request.status === filters.status);
      }
      const total = rows.length;
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total };
    },
    async findLeaveTypeById(id) {
      return leaveTypes.find((type) => type.id === id) ?? null;
    },
    async findUserById(userId) {
      return users.find((user) => user.id === userId) ?? null;
    },
    async findBalance(employeeId, leaveTypeId, year) {
      return (
        balances.find(
          (balance) =>
            balance.employeeId === employeeId &&
            balance.leaveTypeId === leaveTypeId &&
            balance.year === year,
        ) ?? null
      );
    },
    async checkOverlap(employeeId, startDate, endDate) {
      return requests.some(
        (request) =>
          request.employeeId === employeeId &&
          (request.status === "pending" || request.status === "approved") &&
          request.startDate <= endDate &&
          request.endDate >= startDate,
      );
    },
    async createRequest(input) {
      const leaveType = leaveTypes.find((type) => type.id === input.leaveTypeId);
      const status = input.requiresApproval ? "pending" : "approved";
      const year = Number(input.startDate.slice(0, 4));
      let balance = balances.find(
        (row) =>
          row.employeeId === input.employeeId &&
          row.leaveTypeId === input.leaveTypeId &&
          row.year === year,
      );
      if (!balance) {
        balance = {
          employeeId: input.employeeId,
          leaveTypeId: input.leaveTypeId,
          year,
          entitled: input.defaultEntitlement,
          used: 0,
          carried: 0,
          carriedUsed: 0,
          carriedExpiry: null,
          adjustment: 0,
        };
        balances.push(balance);
      }
      if (!input.requiresApproval) {
        if (input.source === "carried") {
          balance.carriedUsed += input.days;
        } else {
          balance.used += input.days;
        }
      }
      const row: LeaveRequestRecord = {
        id: `leave-${requests.length + 1}`,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        leaveTypeName: leaveType?.name ?? "Annual",
        leaveTypeCode: leaveType?.code ?? "AL",
        leaveTypeCategory: leaveType?.category ?? "paid",
        startDate: input.startDate,
        endDate: input.endDate,
        durationType: input.durationType,
        halfDayPeriod: input.halfDayPeriod,
        days: String(input.days),
        reason: input.reason ?? null,
        status,
        createdAt: "2026-07-18T00:00:00.000Z",
      };
      requests.push(row);
      requestMeta[row.id] = {
        currentStepOrder: null,
        delegatedToId: null,
        source: input.source,
        leaveTypeDaysPerYear: input.defaultEntitlement,
      };
      return row;
    },
    async findActiveApprovalSteps() {
      return approvalSteps.filter((step) => step.isActive);
    },
    async initializeApprovalChain(leaveRequestId, rows) {
      const request = requests.find((row) => row.id === leaveRequestId);
      if (!request || request.status !== "pending") return false;
      const meta = requestMeta[leaveRequestId] ?? {
        currentStepOrder: null,
        delegatedToId: null,
        source: "entitled" as const,
        leaveTypeDaysPerYear: 12,
      };
      if (meta.currentStepOrder != null) return false;
      meta.currentStepOrder = 1;
      requestMeta[leaveRequestId] = meta;
      for (const row of rows) {
        decisions.push({
          id: `dec-${decisions.length + 1}`,
          leaveRequestId,
          status: "pending",
          ...row,
        });
      }
      return true;
    },
    async findRequestById(id) {
      const request = requests.find((row) => row.id === id);
      return request ? detailFor(request) : null;
    },
    async findDecisions(leaveRequestId) {
      return decisions
        .filter((decision) => decision.leaveRequestId === leaveRequestId)
        .sort((left, right) => left.order - right.order);
    },
    async findPolicyApprovers(leaveTypeId) {
      return policyApprovers[leaveTypeId] ?? [];
    },
    async approveRequestStep(input) {
      const request = requests.find((row) => row.id === input.requestId);
      if (!request || request.status !== "pending") return null;
      const meta = requestMeta[input.requestId];
      if (!meta || meta.currentStepOrder !== input.expectedStepOrder) {
        return null;
      }
      if (input.currentDecisionId) {
        const decision = decisions.find(
          (row) => row.id === input.currentDecisionId && row.status === "pending",
        );
        if (decision) decision.status = "approved";
      }
      if (input.nextStepOrder === null) {
        request.status = "approved";
        meta.currentStepOrder = null;
        const year = input.year;
        let balance = balances.find(
          (row) =>
            row.employeeId === input.employeeId &&
            row.leaveTypeId === input.leaveTypeId &&
            row.year === year,
        );
        if (!balance) {
          balance = {
            employeeId: input.employeeId,
            leaveTypeId: input.leaveTypeId,
            year,
            entitled: input.defaultEntitlement,
            used: 0,
            carried: 0,
            carriedUsed: 0,
            carriedExpiry: null,
            adjustment: 0,
          };
          balances.push(balance);
        }
        if (input.source === "carried") {
          balance.carriedUsed += input.days;
        } else {
          balance.used += input.days;
        }
      } else {
        meta.currentStepOrder = input.nextStepOrder;
      }
      return request;
    },
    async rejectRequestStep(input) {
      const request = requests.find((row) => row.id === input.requestId);
      if (!request || request.status !== "pending") return null;
      const meta = requestMeta[input.requestId];
      if (!meta || meta.currentStepOrder !== input.expectedStepOrder) {
        return null;
      }
      if (input.currentDecisionId) {
        const decision = decisions.find(
          (row) => row.id === input.currentDecisionId && row.status === "pending",
        );
        if (!decision) return null;
        decision.status = "rejected";
      }
      request.status = "rejected";
      meta.currentStepOrder = null;
      meta.delegatedToId = null;
      return request;
    },
    async cancelRequest(input) {
      const request = requests.find((row) => row.id === input.requestId);
      if (!request || request.status !== input.expectedStatus) return null;
      request.status = "cancelled";
      if (input.refund) {
        const refund = input.refund;
        const balance = balances.find(
          (row) =>
            row.employeeId === refund.employeeId &&
            row.leaveTypeId === refund.leaveTypeId &&
            row.year === refund.year,
        );
        if (balance) {
          if (refund.source === "carried") {
            balance.carriedUsed = Math.max(0, balance.carriedUsed - refund.days);
          } else {
            balance.used = Math.max(0, balance.used - refund.days);
          }
        }
      }
      return request;
    },
  };
}

const sampleRequest = (
  overrides: Partial<LeaveRequestRecord> = {},
): LeaveRequestRecord => ({
  id: "leave-1",
  employeeId: "user-123",
  leaveTypeId: "type-1",
  leaveTypeName: "Annual",
  leaveTypeCode: "AL",
  leaveTypeCategory: "paid",
  startDate: "2026-07-20",
  endDate: "2026-07-21",
  durationType: "full_day",
  halfDayPeriod: null,
  days: "2",
  reason: "Trip",
  status: "pending",
  createdAt: "2026-07-18T00:00:00.000Z",
  ...overrides,
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("leave dual-path routes", () => {
  it("proxies /api/leave/requests when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/leave/requests");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/leave/requests?employeeId=user-123",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for leave when Hyperdrive is flagged on without binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/leave/requests?employeeId=user-123",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists own leave requests on the Hyperdrive path", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest(),
        sampleRequest({
          id: "leave-other",
          employeeId: "user-456",
          reason: "Other",
        }),
      ],
    });

    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests?employeeId=user-123",
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
      id: "leave-1",
      status: "pending",
      leaveType: { id: "type-1", name: "Annual", code: "AL", category: "paid" },
      days: "2",
    });
  });

  it("creates a self leave request with approval-chain fallback on Hyperdrive", async () => {
    const store = memoryStore({
      leaveTypes: [
        {
          id: "type-1",
          name: "Annual",
          code: "AL",
          category: "paid",
          entityId: null,
          daysPerYear: 12,
          requiresApproval: true,
          isActive: true,
        },
      ],
    });
    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests",
      {
        body: JSON.stringify({
          leaveTypeId: "type-1",
          startDate: "2026-07-20",
          endDate: "2026-07-21",
          reason: "Trip",
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
      data: { id: "leave-1", status: "pending" },
    });
  });

  it("rejects leave create when entitled balance is insufficient", async () => {
    const store = memoryStore({
      leaveTypes: [
        {
          id: "type-1",
          name: "Annual",
          code: "AL",
          category: "paid",
          entityId: null,
          daysPerYear: 1,
          requiresApproval: true,
          isActive: true,
        },
      ],
    });
    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests",
      {
        body: JSON.stringify({
          leaveTypeId: "type-1",
          startDate: "2026-07-20",
          endDate: "2026-07-22",
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INSUFFICIENT_LEAVE_BALANCE",
    });
  });

  it("auto-approves leave types that do not require approval", async () => {
    const store = memoryStore({
      leaveTypes: [
        {
          id: "type-auto",
          name: "Comp",
          code: "COMP",
          category: "paid",
          entityId: null,
          daysPerYear: 5,
          requiresApproval: false,
          isActive: true,
        },
      ],
    });
    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests",
      {
        body: JSON.stringify({
          leaveTypeId: "type-auto",
          startDate: "2026-07-20",
          endDate: "2026-07-20",
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
      data: { status: "approved" },
    });
  });

  it("proxies HR on-behalf create and non-self leave filters when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "POST") {
        expect(url.pathname).toBe("/api/leave/requests");
        return Response.json({ data: { id: "proxied", status: "pending" } }, {
          status: 201,
        });
      }
      expect(url.searchParams.get("employeeId")).toBe("user-456");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createLeaveStore: async () => memoryStore(),
      verifyToken,
    });

    const createResponse = await app.request(
      "https://intranet.example/api/leave/requests",
      {
        body: JSON.stringify({
          leaveTypeId: "type-1",
          startDate: "2026-07-20",
          endDate: "2026-07-21",
          employeeId: "user-456",
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(createResponse.status).toBe(201);

    const teamResponse = await app.request(
      "https://intranet.example/api/leave/requests?employeeId=user-456",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(teamResponse.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("approves leave as the employee's manager on Hyperdrive", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest({
          id: "leave-team",
          employeeId: "user-456",
          status: "pending",
        }),
      ],
      permissionsByUser: {
        "user-123": ["leave:approve"],
      },
      users: [
        {
          id: "user-123",
          entityId: "entity-1",
          isActive: true,
          reportingTo: null,
        },
        {
          id: "user-456",
          entityId: "entity-1",
          isActive: true,
          reportingTo: "user-123",
        },
      ],
      leaveTypes: [
        {
          id: "type-1",
          name: "Annual",
          code: "AL",
          category: "paid",
          entityId: null,
          daysPerYear: 12,
          requiresApproval: true,
          isActive: true,
        },
      ],
      decisions: [
        {
          id: "dec-1",
          leaveRequestId: "leave-team",
          order: 1,
          name: "Manager approval",
          approverType: "manager",
          approverUserId: null,
          status: "pending",
        },
      ],
      requestMeta: {
        "leave-team": {
          currentStepOrder: 1,
          delegatedToId: null,
          source: "entitled",
          leaveTypeDaysPerYear: 12,
        },
      },
    });

    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests/leave-team/approve",
      {
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
        body: "{}",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "leave-team", status: "approved" },
    });
  });

  it("rejects leave approve when actor is not manager or HR", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest({
          id: "leave-team",
          employeeId: "user-456",
          status: "pending",
        }),
      ],
      permissionsByUser: {
        "user-123": ["leave:approve"],
      },
      users: [
        {
          id: "user-123",
          entityId: "entity-1",
          isActive: true,
          reportingTo: null,
        },
        {
          id: "user-456",
          entityId: "entity-1",
          isActive: true,
          reportingTo: "manager-other",
        },
      ],
      leaveTypes: [
        {
          id: "type-1",
          name: "Annual",
          code: "AL",
          category: "paid",
          entityId: null,
          daysPerYear: 12,
          requiresApproval: true,
          isActive: true,
        },
      ],
      decisions: [
        {
          id: "dec-1",
          leaveRequestId: "leave-team",
          order: 1,
          name: "Manager approval",
          approverType: "manager",
          approverUserId: null,
          status: "pending",
        },
      ],
      requestMeta: {
        "leave-team": {
          currentStepOrder: 1,
          delegatedToId: null,
          source: "entitled",
          leaveTypeDaysPerYear: 12,
        },
      },
    });

    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests/leave-team/approve",
      {
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
        body: "{}",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(403);
  });

  it("cancels own pending leave on Hyperdrive", async () => {
    const store = memoryStore({
      requests: [sampleRequest({ id: "leave-1", status: "pending" })],
      requestMeta: {
        "leave-1": {
          currentStepOrder: 1,
          delegatedToId: null,
          source: "entitled",
          leaveTypeDaysPerYear: 12,
        },
      },
      leaveTypes: [
        {
          id: "type-1",
          name: "Annual",
          code: "AL",
          category: "paid",
          entityId: null,
          daysPerYear: 12,
          requiresApproval: true,
          isActive: true,
        },
      ],
    });
    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests/leave-1/cancel",
      {
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
        body: "{}",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "leave-1", status: "cancelled" },
    });
  });

  it("rejects leave with reason as manager on Hyperdrive", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest({
          id: "leave-team",
          employeeId: "user-456",
          status: "pending",
        }),
      ],
      permissionsByUser: {
        "user-123": ["leave:approve"],
      },
      users: [
        {
          id: "user-123",
          entityId: "entity-1",
          isActive: true,
          reportingTo: null,
        },
        {
          id: "user-456",
          entityId: "entity-1",
          isActive: true,
          reportingTo: "user-123",
        },
      ],
      leaveTypes: [
        {
          id: "type-1",
          name: "Annual",
          code: "AL",
          category: "paid",
          entityId: null,
          daysPerYear: 12,
          requiresApproval: true,
          isActive: true,
        },
      ],
      decisions: [
        {
          id: "dec-1",
          leaveRequestId: "leave-team",
          order: 1,
          name: "Manager approval",
          approverType: "manager",
          approverUserId: null,
          status: "pending",
        },
      ],
      requestMeta: {
        "leave-team": {
          currentStepOrder: 1,
          delegatedToId: null,
          source: "entitled",
          leaveTypeDaysPerYear: 12,
        },
      },
    });

    const app = createEdgeApp({
      createLeaveStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/leave/requests/leave-team/reject",
      {
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
        body: JSON.stringify({ reason: "Coverage needed" }),
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "leave-team", status: "rejected" },
    });
  });
});
