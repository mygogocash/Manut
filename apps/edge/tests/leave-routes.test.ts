import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type { LeaveRequestRecord, LeaveStore } from "../src/leave/store";
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
}): LeaveStore {
  const requests = [...(seed?.requests ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["leave:read", "leave:request"],
  };

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

  it("proxies create and non-self leave filters when Hyperdrive is on", async () => {
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
});
