import { afterEach, describe, expect, it, vi } from "vitest";

import type { DealsStore } from "../src/deals/store";
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
  deals?: Array<{
    id: string;
    company: string;
    contact: string | null;
    value: number;
    stage: string;
    probability: number;
    type: string | null;
    country: string | null;
    closeDate: string | null;
    notes: string | null;
    ownerId: string;
    ownerName: string;
    createdAt: string;
    updatedAt: string;
  }>;
  permissionsByUser?: Record<string, string[]>;
}): DealsStore {
  const deals = [...(seed?.deals ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["deals:read", "deals:create"],
  };

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findMany(filters, page, limit) {
      let rows = [...deals];
      if (filters.ownerScope) {
        rows = rows.filter((deal) => filters.ownerScope?.includes(deal.ownerId));
      }
      if (filters.stage) {
        rows = rows.filter((deal) => deal.stage === filters.stage);
      }
      if (filters.type) {
        rows = rows.filter((deal) => deal.type === filters.type);
      }
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        rows = rows.filter((deal) =>
          deal.company.toLowerCase().includes(needle),
        );
      }
      const total = rows.length;
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total };
    },
    async findById(id) {
      return deals.find((deal) => deal.id === id) ?? null;
    },
    async create(input) {
      const now = new Date().toISOString();
      const row = {
        id: `deal-${deals.length + 1}`,
        company: input.company,
        contact: input.contact ?? null,
        value: input.value,
        stage: input.stage,
        probability: input.probability,
        type: input.type ?? null,
        country: input.country ?? null,
        closeDate: input.closeDate ?? null,
        notes: input.notes ?? null,
        ownerId: input.ownerId,
        ownerName: "Test User",
        createdAt: now,
        updatedAt: now,
      };
      deals.push(row);
      return row;
    },
    async update(id, input) {
      const row = deals.find((deal) => deal.id === id);
      if (!row) throw new Error("missing");
      if (input.company !== undefined) row.company = input.company;
      if (input.contact !== undefined) row.contact = input.contact;
      if (input.value !== undefined) row.value = input.value;
      if (input.stage !== undefined) row.stage = input.stage;
      if (input.probability !== undefined) row.probability = input.probability;
      if (input.type !== undefined) row.type = input.type;
      if (input.country !== undefined) row.country = input.country;
      if (input.closeDate !== undefined) row.closeDate = input.closeDate;
      if (input.notes !== undefined) row.notes = input.notes;
      row.updatedAt = new Date().toISOString();
      return row;
    },
    async pipelineSummary(ownerScope) {
      const rows = ownerScope
        ? deals.filter((deal) => ownerScope.includes(deal.ownerId))
        : deals;
      const byStage = new Map<string, { count: number; totalValue: number }>();
      for (const deal of rows) {
        const current = byStage.get(deal.stage) ?? { count: 0, totalValue: 0 };
        current.count += 1;
        current.totalValue += deal.value;
        byStage.set(deal.stage, current);
      }
      return [...byStage.entries()].map(([stage, stats]) => ({
        stage,
        count: stats.count,
        totalValue: stats.totalValue,
      }));
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("deals dual-path routes", () => {
  it("proxies /api/deals to Express when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/deals");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/deals",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for deals when Hyperdrive is flagged on without a binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/deals",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists own deals on the Hyperdrive path without crm:team-read", async () => {
    const store = memoryStore({
      deals: [
        {
          id: "deal-own",
          company: "Acme",
          contact: null,
          value: 1000,
          stage: "lead",
          probability: 10,
          type: null,
          country: null,
          closeDate: null,
          notes: null,
          ownerId: "user-123",
          ownerName: "Test User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
        {
          id: "deal-other",
          company: "Other Co",
          contact: null,
          value: 2000,
          stage: "lead",
          probability: 10,
          type: null,
          country: null,
          closeDate: null,
          notes: null,
          ownerId: "user-456",
          ownerName: "Other User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });

    const app = createEdgeApp({
      createDealsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/deals?page=1&limit=20",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<Record<string, unknown>>;
      meta: Record<string, unknown>;
    };
    expect(body).toMatchObject({
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "deal-own",
      company: "Acme",
      owner: { id: "user-123", name: "Test User" },
    });
    expect(body.data[0]).not.toHaveProperty("notes");
    expect(
      (body.data[0]?.owner as Record<string, unknown> | undefined) ?? {},
    ).not.toHaveProperty("email");
  });

  it("lists all deals when crm:team-read is present", async () => {
    const store = memoryStore({
      permissionsByUser: {
        "user-123": ["deals:read", "deals:create", "crm:team-read"],
      },
      deals: [
        {
          id: "deal-own",
          company: "Acme",
          contact: null,
          value: 1000,
          stage: "lead",
          probability: 10,
          type: null,
          country: null,
          closeDate: null,
          notes: null,
          ownerId: "user-123",
          ownerName: "Test User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
        {
          id: "deal-other",
          company: "Other Co",
          contact: null,
          value: 2000,
          stage: "qualified",
          probability: 20,
          type: null,
          country: null,
          closeDate: null,
          notes: null,
          ownerId: "user-456",
          ownerName: "Other User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });

    const app = createEdgeApp({
      createDealsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/deals",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: unknown[];
      meta: { total: number };
    };
    expect(body.meta.total).toBe(2);
    expect(body.data).toHaveLength(2);
  });

  it("creates a deal on the Hyperdrive path", async () => {
    const store = memoryStore();
    const app = createEdgeApp({
      createDealsStore: async () => store,
      verifyToken,
    });
    const response = await app.request("https://intranet.example/api/deals", {
      body: JSON.stringify({
        company: "New Co",
        value: 5000,
        stage: "lead",
        probability: 15,
      }),
      headers: {
        authorization: `Bearer ${TEST_TOKEN}`,
        "content-type": "application/json",
      },
      method: "POST",
    }, hyperdriveEnv());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        company: "New Co",
        value: 5000,
        stage: "lead",
        owner: { id: "user-123", name: "Test User" },
      }),
    });
  });

  it("returns pipeline summary on the Hyperdrive path", async () => {
    const store = memoryStore({
      deals: [
        {
          id: "deal-own",
          company: "Acme",
          contact: null,
          value: 1000,
          stage: "lead",
          probability: 10,
          type: null,
          country: null,
          closeDate: null,
          notes: null,
          ownerId: "user-123",
          ownerName: "Test User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
        {
          id: "deal-other",
          company: "Other Co",
          contact: null,
          value: 2000,
          stage: "qualified",
          probability: 20,
          type: null,
          country: null,
          closeDate: null,
          notes: null,
          ownerId: "user-456",
          ownerName: "Other User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    const app = createEdgeApp({
      createDealsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/deals/pipeline",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ stage: "lead", count: 1, totalValue: 1000 }],
    });
  });

  it("gets and updates own deal on the Hyperdrive path", async () => {
    const store = memoryStore({
      permissionsByUser: {
        "user-123": ["deals:read", "deals:create", "deals:update"],
      },
      deals: [
        {
          id: "deal-own",
          company: "Acme",
          contact: null,
          value: 1000,
          stage: "lead",
          probability: 10,
          type: null,
          country: null,
          closeDate: null,
          notes: "secret",
          ownerId: "user-123",
          ownerName: "Test User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    const app = createEdgeApp({
      createDealsStore: async () => store,
      verifyToken,
    });

    const getResponse = await app.request(
      "https://intranet.example/api/deals/deal-own",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(getResponse.status).toBe(200);
    const getBody = (await getResponse.json()) as {
      data: Record<string, unknown>;
    };
    expect(getBody.data).toMatchObject({
      id: "deal-own",
      company: "Acme",
      owner: { id: "user-123", name: "Test User" },
    });
    expect(getBody.data).not.toHaveProperty("notes");

    const putResponse = await app.request(
      "https://intranet.example/api/deals/deal-own",
      {
        body: JSON.stringify({ stage: "qualified", probability: 40 }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
      hyperdriveEnv(),
    );
    expect(putResponse.status).toBe(200);
    await expect(putResponse.json()).resolves.toMatchObject({
      data: { id: "deal-own", stage: "qualified", probability: 40 },
    });
  });

  it("404s get for another owner's deal without crm:team-read", async () => {
    const store = memoryStore({
      deals: [
        {
          id: "deal-other",
          company: "Other Co",
          contact: null,
          value: 2000,
          stage: "lead",
          probability: 10,
          type: null,
          country: null,
          closeDate: null,
          notes: null,
          ownerId: "user-456",
          ownerName: "Other User",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    const app = createEdgeApp({
      createDealsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/deals/deal-other",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(response.status).toBe(404);
  });

  it("proxies deal hard-delete even when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(request.method).toBe("DELETE");
      expect(new URL(request.url).pathname).toBe("/api/deals/deal-own");
      return Response.json({ data: { success: true } });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createDealsStore: async () =>
        memoryStore({
          permissionsByUser: {
            "user-123": ["deals:read", "deals:delete"],
          },
        }),
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/deals/deal-own",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "DELETE",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("requires authentication before deals proxy or Hyperdrive handling", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/deals",
      {},
      testEnv(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });
});
