import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { errorHandler } from "@/core/middleware/error-handler";
import dealsRoutes from "@/modules/deals/deals.controller";
import { dealService } from "@/modules/deals/deals.service";

// Mock the service so the integration test exercises only the controller +
// router shape. The Sales CRM v2 cutover (PRD §9) lives behind /api/leads,
// /api/accounts, /api/opportunities; legacy /api/deals must keep responding
// with the same envelope until Phase 3 drops the route.
vi.mock("@/modules/deals/deals.service", () => ({
  dealService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getPipelineSummary: vi.fn(),
  },
}));

vi.mock("@/core/guards/auth.guard", () => ({
  authenticate: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    (req as express.Request & { user?: unknown }).user = {
      id: "u-1",
      email: "u@example.com",
      name: "U",
      isActive: true,
      entityId: null,
      permissions: ["deals:read"],
    };
    next();
  },
  requireActive: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
  requirePermission:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) =>
      next(),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/deals", dealsRoutes);
  app.use(errorHandler);
  return app;
}

const baseDeal = {
  id: "deal-1",
  company: "Acme",
  contact: "Jane Doe",
  value: 1000,
  stage: "qualified",
  probability: 30,
  closeDate: null,
  type: null,
  country: null,
  notes: null,
  partnerId: null,
  ownerId: "u-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  owner: { id: "u-1", name: "U", email: "u@example.com" },
  partner: null,
};

describe("GET /api/deals — legacy response shape (PRD §9 stability)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the same { data, meta } envelope as before the v2 cutover", async () => {
    (dealService.list as Mock).mockResolvedValue({
      data: [baseDeal],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(buildApp()).get("/api/deals");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [baseDeal],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("GET /api/deals/:id still wraps the row in { data: ... }", async () => {
    (dealService.getById as Mock).mockResolvedValue(baseDeal);

    const res = await request(buildApp()).get("/api/deals/deal-1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: baseDeal });
  });

  it("GET /api/deals/pipeline still returns { data: [...] }", async () => {
    (dealService.getPipelineSummary as Mock).mockResolvedValue([
      { stage: "qualified", count: 1, totalValue: 1000 },
    ]);

    const res = await request(buildApp()).get("/api/deals/pipeline");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ stage: "qualified", count: 1, totalValue: 1000 }],
    });
  });
});
