import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CashAdvanceApprovalDecisionRecord,
  CashAdvanceRequestRecord,
  CashAdvanceStore,
  CashAdvanceUserRecord,
} from "../src/cash-advance/store";
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

function sampleRequest(
  overrides: Partial<CashAdvanceRequestRecord> = {},
): CashAdvanceRequestRecord {
  return {
    id: "ca-own",
    requestNumber: 1,
    requestDate: "2026-07-18",
    payoutMode: "cash",
    currency: "THB",
    status: "draft",
    requestedTotal: 500,
    approvedTotal: 0,
    rejectReason: null,
    employeeId: "user-123",
    employeeName: "Test User",
    employeeEmail: "user@example.com",
    entityId: null,
    entityName: null,
    items: [
      {
        id: "item-1",
        description: "Taxi",
        receiptUrl: null,
        requestedAmount: 500,
        approvedAmount: 0,
      },
    ],
    bankName: null,
    bankAccountNo: null,
    notes: null,
    currentStepOrder: null,
    ...overrides,
  };
}

function memoryStore(seed?: {
  requests?: CashAdvanceRequestRecord[];
  permissionsByUser?: Record<string, string[]>;
  registeredUploads?: Array<{
    id: string;
    bucket: string;
    path: string;
    purpose: string;
    uploadedBy: string;
    linkedTo?: string;
    linkedId?: string;
  }>;
  users?: CashAdvanceUserRecord[];
  decisions?: CashAdvanceApprovalDecisionRecord[];
}): CashAdvanceStore {
  const requests = [...(seed?.requests ?? [])];
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["cash-advance:read", "cash-advance:create"],
  };
  const registeredUploads = [...(seed?.registeredUploads ?? [])];
  const users = [
    ...(seed?.users ?? [{ id: "user-123", reportingTo: null }]),
  ];
  const decisions = [...(seed?.decisions ?? [])];

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
            upload.uploadedBy === query.uploadedBy) &&
          (query.linkedTo === undefined ||
            upload.linkedTo === query.linkedTo) &&
          (query.linkedId === undefined || upload.linkedId === query.linkedId),
      );
      return match ? { id: match.id } : null;
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
    async create(input) {
      const requestedTotal = input.items.reduce(
        (sum, item) => sum + item.requestedAmount,
        0,
      );
      const row: CashAdvanceRequestRecord = {
        id: `ca-${requests.length + 1}`,
        requestNumber: requests.length + 1,
        requestDate: "2026-07-18",
        payoutMode: input.payoutMode,
        currency: input.currency,
        status: "draft",
        requestedTotal,
        approvedTotal: 0,
        rejectReason: null,
        employeeId: input.employeeId,
        employeeName: "Test User",
        employeeEmail: "user@example.com",
        entityId: input.entityId ?? null,
        entityName: input.entityId ? "Manut TH" : null,
        items: input.items.map((item, index) => ({
          id: `item-${index + 1}`,
          description: item.description,
          receiptUrl: item.receiptUrl ?? null,
          requestedAmount: item.requestedAmount,
          approvedAmount: 0,
        })),
        bankName: input.bankName ?? null,
        bankAccountNo: input.bankAccountNo ?? null,
        notes: input.notes ?? null,
        currentStepOrder: null,
      };
      requests.push(row);
      return row;
    },
    async update(id, input) {
      const row = requests.find((request) => request.id === id);
      if (!row) throw new Error("missing");
      if (input.payoutMode !== undefined) row.payoutMode = input.payoutMode;
      if (input.currency !== undefined) row.currency = input.currency;
      if (input.notes !== undefined) row.notes = input.notes;
      if (input.bankName !== undefined) row.bankName = input.bankName;
      if (input.bankAccountNo !== undefined) {
        row.bankAccountNo = input.bankAccountNo;
      }
      if (input.items) {
        row.items = input.items.map((item, index) => ({
          id: `item-${index + 1}`,
          description: item.description,
          receiptUrl: item.receiptUrl ?? null,
          requestedAmount: item.requestedAmount,
          approvedAmount: 0,
        }));
        row.requestedTotal = input.items.reduce(
          (sum, item) => sum + item.requestedAmount,
          0,
        );
      }
      return row;
    },
    async findById(id) {
      return requests.find((request) => request.id === id) ?? null;
    },
    async findActiveApprovalSteps() {
      return [];
    },
    async submitWithDecisions(id, rows) {
      const row = requests.find((request) => request.id === id);
      if (!row) throw new Error("missing");
      row.status = "submitted";
      row.rejectReason = null;
      row.currentStepOrder = 1;
      decisions.length = 0;
      for (const decision of rows) {
        decisions.push({
          id: `dec-${decisions.length + 1}`,
          requestId: id,
          status: "pending",
          ...decision,
        });
      }
      return row;
    },
    async findUserById(userId) {
      return users.find((user) => user.id === userId) ?? null;
    },
    async findDecisions(requestId) {
      return decisions
        .filter((decision) => decision.requestId === requestId)
        .sort((left, right) => left.order - right.order);
    },
    async createDecisions(requestId, rows) {
      for (const row of rows) {
        decisions.push({
          id: `dec-${decisions.length + 1}`,
          requestId,
          status: "pending",
          ...row,
        });
      }
    },
    async updateDecision(id, data) {
      const decision = decisions.find((row) => row.id === id);
      if (decision) decision.status = data.status;
    },
    async updateApprovedAmounts(items) {
      for (const item of items) {
        for (const request of requests) {
          const target = request.items.find((row) => row.id === item.id);
          if (target) target.approvedAmount = item.approvedAmount;
        }
      }
    },
    async advanceStep(id, nextStepOrder) {
      const row = requests.find((request) => request.id === id);
      if (!row) throw new Error("missing");
      row.currentStepOrder = nextStepOrder;
      return row;
    },
    async finalizeApproval(id, data) {
      const row = requests.find((request) => request.id === id);
      if (!row) throw new Error("missing");
      row.status = "approved";
      row.approvedTotal = data.approvedTotal;
      row.rejectReason = null;
      return row;
    },
    async markRejected(id, data) {
      const row = requests.find((request) => request.id === id);
      if (!row) throw new Error("missing");
      row.status = "rejected";
      row.rejectReason = data.rejectReason;
      return row;
    },
    async markDisbursedIfApproved(id, data) {
      const row = requests.find((request) => request.id === id);
      if (!row || row.status !== "approved") return null;
      const proof = registeredUploads.find(
        (upload) =>
          upload.id === data.proofUploadId &&
          upload.purpose === "cash-advance-disbursement-proof" &&
          upload.linkedTo === "cash-advance" &&
          upload.linkedId === id &&
          upload.uploadedBy === data.uploadedBy,
      );
      if (!proof) return null;
      row.status = "disbursed";
      return row;
    },
    async markClearedIfDisbursed(id) {
      const row = requests.find((request) => request.id === id);
      if (!row || row.status !== "disbursed") return null;
      row.status = "cleared";
      return row;
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("cash-advance dual-path routes", () => {
  it("proxies /api/cash-advance when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/cash-advance");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/cash-advance",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for cash-advance when Hyperdrive is flagged on without binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/cash-advance",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists own cash advances on the Hyperdrive path", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest(),
        sampleRequest({
          id: "ca-other",
          requestNumber: 2,
          requestedTotal: 100,
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
          items: [],
        }),
      ],
    });

    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance?scope=mine",
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
      id: "ca-own",
      requestedTotal: 500,
      employee: { id: "user-123" },
    });
  });

  it("creates a cash advance without receipts on the Hyperdrive path", async () => {
    const store = memoryStore();
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance",
      {
        body: JSON.stringify({
          payoutMode: "cash",
          currency: "THB",
          items: [{ description: "Taxi", requestedAmount: 250 }],
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
        status: "draft",
        requestedTotal: 250,
        items: [{ description: "Taxi" }],
      },
    });
  });

  it("submits own draft cash advance on the Hyperdrive path", async () => {
    const store = memoryStore({
      requests: [sampleRequest()],
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-own/submit",
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
      data: { id: "ca-own", status: "submitted" },
    });
  });

  it("rejects submit for another user's cash advance", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest({
          id: "ca-other",
          requestNumber: 2,
          requestedTotal: 100,
          employeeId: "user-456",
          employeeName: "Other",
          employeeEmail: "other@example.com",
        }),
      ],
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-other/submit",
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

    expect(response.status).toBe(403);
  });

  it("proxies scope=all and managed receipt creates without TRUSTED_STORAGE_ORIGINS", async () => {
    const upstream = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe("/api/cash-advance");
      if (request.method === "GET") {
        expect(url.searchParams.get("scope")).toBe("all");
      }
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createCashAdvanceStore: async () => memoryStore(),
      verifyToken,
    });

    const listResponse = await app.request(
      "https://intranet.example/api/cash-advance?scope=all",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(listResponse.status).toBe(200);

    const createResponse = await app.request(
      "https://intranet.example/api/cash-advance",
      {
        body: JSON.stringify({
          payoutMode: "cash",
          items: [
            {
              description: "Taxi",
              requestedAmount: 250,
              receiptUrl:
                "https://files.manut.example/storage/v1/object/public/receipts/u/r.pdf",
            },
          ],
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );
    expect(createResponse.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("creates cash advance with registered receipt when TRUSTED_STORAGE_ORIGINS is set", async () => {
    const receiptUrl =
      "https://files.manut.example/storage/v1/object/public/receipts/user-123/r1.pdf";
    const store = memoryStore({
      registeredUploads: [
        {
          id: "upload-1",
          bucket: "receipts",
          path: "user-123/r1.pdf",
          purpose: "cash-advance-receipt",
          uploadedBy: "user-123",
        },
      ],
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance",
      {
        body: JSON.stringify({
          payoutMode: "cash",
          currency: "THB",
          items: [
            {
              description: "Taxi",
              requestedAmount: 250,
              receiptUrl,
            },
          ],
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
      data: {
        status: "draft",
        items: [{ description: "Taxi", receiptUrl }],
      },
    });
  });

  it("updates own draft cash advance with registered receipt on Hyperdrive", async () => {
    const receiptUrl =
      "https://files.manut.example/storage/v1/object/public/receipts/user-123/r2.pdf";
    const store = memoryStore({
      requests: [
        sampleRequest({
          requestedTotal: 100,
          items: [
            {
              id: "item-1",
              description: "Old",
              receiptUrl: null,
              requestedAmount: 100,
              approvedAmount: 0,
            },
          ],
        }),
      ],
      registeredUploads: [
        {
          id: "upload-2",
          bucket: "receipts",
          path: "user-123/r2.pdf",
          purpose: "cash-advance-receipt",
          uploadedBy: "user-123",
        },
      ],
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-own",
      {
        body: JSON.stringify({
          items: [
            {
              description: "Taxi",
              requestedAmount: 300,
              receiptUrl,
            },
          ],
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
      hyperdriveEnv({
        TRUSTED_STORAGE_ORIGINS: "https://files.manut.example",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "ca-own",
        requestedTotal: 300,
        items: [{ description: "Taxi", receiptUrl }],
      },
    });
  });

  it("approves submitted cash advance as manager on Hyperdrive", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest({
          id: "ca-team",
          employeeId: "user-456",
          employeeName: "Report",
          employeeEmail: "report@example.com",
          status: "submitted",
          currentStepOrder: 1,
        }),
      ],
      permissionsByUser: {
        "user-123": ["cash-advance:read"],
      },
      users: [
        { id: "user-123", reportingTo: null },
        { id: "user-456", reportingTo: "user-123" },
      ],
      decisions: [
        {
          id: "dec-1",
          requestId: "ca-team",
          order: 1,
          name: "Manager approval",
          approverType: "manager",
          approverUserId: null,
          status: "pending",
        },
      ],
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-team/approve",
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
      data: { id: "ca-team", status: "approved", approvedTotal: 500 },
    });
  });

  it("rejects cash-advance approve when actor is not step approver", async () => {
    const store = memoryStore({
      requests: [
        sampleRequest({
          id: "ca-team",
          employeeId: "user-456",
          status: "submitted",
          currentStepOrder: 1,
        }),
      ],
      permissionsByUser: {
        "user-123": ["cash-advance:read"],
      },
      users: [
        { id: "user-123", reportingTo: null },
        { id: "user-456", reportingTo: "manager-other" },
      ],
      decisions: [
        {
          id: "dec-1",
          requestId: "ca-team",
          order: 1,
          name: "Manager approval",
          approverType: "manager",
          approverUserId: null,
          status: "pending",
        },
      ],
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-team/approve",
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

    expect(response.status).toBe(403);
  });

  it("disburses approved cash advance with registered proof on Hyperdrive", async () => {
    const proofUrl =
      "https://files.manut.example/storage/v1/object/public/documents/user-123/proof.pdf";
    const store = memoryStore({
      requests: [
        sampleRequest({
          status: "approved",
          approvedTotal: 500,
        }),
      ],
      permissionsByUser: {
        "user-123": ["cash-advance:approve"],
      },
      registeredUploads: [
        {
          id: "proof-1",
          bucket: "documents",
          path: "user-123/proof.pdf",
          purpose: "cash-advance-disbursement-proof",
          uploadedBy: "user-123",
          linkedTo: "cash-advance",
          linkedId: "ca-own",
        },
      ],
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-own/disburse",
      {
        body: JSON.stringify({ proofUrl }),
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

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "ca-own", status: "disbursed" },
    });
  });

  it("clears disbursed cash advance on Hyperdrive", async () => {
    const store = memoryStore({
      requests: [sampleRequest({ status: "disbursed", approvedTotal: 500 })],
      permissionsByUser: {
        "user-123": ["cash-advance:approve"],
      },
    });
    const app = createEdgeApp({
      createCashAdvanceStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-own/clear",
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
      data: { id: "ca-own", status: "cleared" },
    });
  });

  it("proxies signed receipt GET even when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe(
        "/api/cash-advance/ca-own/items/item-1/receipt",
      );
      return Response.json({ url: "https://signed.example/r.pdf" });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createCashAdvanceStore: async () => memoryStore(),
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/cash-advance/ca-own/items/item-1/receipt",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });
});
