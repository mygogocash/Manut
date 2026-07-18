import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type { RuntimeBindings } from "../src/runtime";
import type { VisaListRecord, VisaStore } from "../src/visa/store";

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
  records?: VisaListRecord[];
  permissionsByUser?: Record<string, string[]>;
}): VisaStore {
  const records = [...(seed?.records ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["visa:read"],
  };

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findMany(filters, page, limit) {
      let rows = records.filter(
        (record) => record.employeeId === filters.employeeId,
      );
      if (filters.status) {
        rows = rows.filter((record) => record.status === filters.status);
      }
      const total = rows.length;
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total };
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("visa dual-path routes", () => {
  it("proxies /api/visa when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/visa");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/visa",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for visa when Hyperdrive is flagged on without binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/visa",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists own visas on the Hyperdrive path", async () => {
    const store = memoryStore({
      records: [
        {
          id: "visa-own",
          holderType: "employee",
          holderName: null,
          holderRelationship: null,
          visaType: "Non-B",
          country: "TH",
          nationality: "US",
          issueDate: "2025-01-01",
          expiryDate: "2026-12-31",
          workPermitExpiryDate: null,
          status: "active",
          documentUrl: null,
          documents: [{ name: "passport", category: "passport_front" }],
          employeeId: "user-123",
          employeeName: "Test User",
          employeeEmail: "user@example.com",
          entityId: "entity-1",
          entityName: "Manut TH",
        },
      ],
    });

    const app = createEdgeApp({
      createVisaStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/visa",
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
      id: "visa-own",
      visaType: "Non-B",
      employee: { id: "user-123" },
      documents: [{ name: "passport", category: "passport_front" }],
    });
  });

  it("proxies HR visa lists and KB leftovers when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      expect(["/api/visa", "/api/visa-kb/for-record"]).toContain(path);
      return Response.json({ data: [] });
    });
    vi.stubGlobal("fetch", upstream);

    const hrStore = memoryStore({
      permissionsByUser: {
        "user-123": ["visa:read", "visa:hr-read"],
      },
    });
    const app = createEdgeApp({
      createVisaStore: async () => hrStore,
      verifyToken,
    });

    const hrList = await app.request(
      "https://intranet.example/api/visa",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(hrList.status).toBe(200);

    const kbLeftover = await app.request(
      "https://intranet.example/api/visa-kb/for-record?country=TH&visaType=Non-B",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(kbLeftover.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("fails closed for visa-kb when Hyperdrive is flagged on without binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/visa-kb",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("fails closed for visa-checklist templates when Hyperdrive is flagged on without binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/visa-checklist/templates",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });
});
