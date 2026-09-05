import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type * as AuthGuardModuleNs from "@/core/guards/auth.guard";
import { errorHandler } from "@/core/middleware/error-handler";
import integrationsRoutes from "@/modules/integrations/integrations.controller";
import { integrationsService } from "@/modules/integrations/integrations.service";

// Mock the service entirely so the controller is tested in isolation.
vi.mock("@/modules/integrations/integrations.service", () => ({
  integrationsService: {
    startOauth: vi.fn(),
    completeOauth: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn(),
    listGmail: vi.fn(),
    readGmail: vi.fn(),
    sendGmail: vi.fn(),
    listDrive: vi.fn(),
  },
}));

// Mock the auth guards: authenticate attaches a fake user when test header set;
// requirePermission is a passthrough.
vi.mock("@/core/guards/auth.guard", async () => {
  const real = await vi.importActual<typeof AuthGuardModuleNs>(
    "@/core/guards/auth.guard",
  );
  return {
    ...real,
    authenticate: (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const uid = req.header("x-test-user");
      if (uid) {
        req.user = {
          id: uid,
          email: "test@example.com",
          name: "Test",
          isActive: true,
          entityId: null,
          permissions: ["integrations:use"],
        };
        return next();
      }
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Unauthorized" },
      });
    },
    requirePermission:
      () =>
      (
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction,
      ) =>
        next(),
  };
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/integrations", integrationsRoutes);
  app.use(errorHandler);
  return app;
}

describe("GET /api/integrations/google/oauth-start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticated user > 200 with { data: { url } } and url contains state param", async () => {
    (integrationsService.startOauth as Mock).mockResolvedValue({
      url: "https://accounts.google.com/x?state=abc123",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/integrations/google/oauth-start")
      .set("x-test-user", "u-1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { url: "https://accounts.google.com/x?state=abc123" },
    });
    expect(res.body.data.url).toContain("state=");
    expect(integrationsService.startOauth).toHaveBeenCalledWith({
      userId: "u-1",
      redirect: undefined,
    });
  });

  it("with redirect query > forwards redirect to service", async () => {
    (integrationsService.startOauth as Mock).mockResolvedValue({
      url: "https://accounts.google.com/x?state=zzz",
    });

    const app = buildApp();
    await request(app)
      .get("/api/integrations/google/oauth-start?redirect=%2Fsettings")
      .set("x-test-user", "u-1")
      .expect(200);

    expect(integrationsService.startOauth).toHaveBeenCalledWith({
      userId: "u-1",
      redirect: "/settings",
    });
  });

  it("unauthenticated > 401", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/integrations/google/oauth-start");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/integrations/google/oauth-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("with valid state > 303 to settings?connected=1", async () => {
    (integrationsService.completeOauth as Mock).mockResolvedValue({
      accountEmail: "u@x",
      redirect: undefined,
    });

    const app = buildApp();
    const res = await request(app).get(
      "/api/integrations/google/oauth-callback?code=C&state=S",
    );

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(
      "http://localhost:3000/settings?tab=integrations&connected=1",
    );
  });

  it("with invalid state > 303 to settings?error=invalid_state", async () => {
    (integrationsService.completeOauth as Mock).mockRejectedValue(
      new Error("INVALID_OR_EXPIRED_STATE"),
    );

    const app = buildApp();
    const res = await request(app).get(
      "/api/integrations/google/oauth-callback?code=C&state=bad",
    );

    expect(res.status).toBe(303);
    expect(res.headers.location).toContain(
      "/settings?tab=integrations&error=invalid_state",
    );
  });

  it("with error query (consent denied) > 303 to settings?error=...", async () => {
    const app = buildApp();
    const res = await request(app).get(
      "/api/integrations/google/oauth-callback?state=S&error=access_denied",
    );

    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("error=access_denied");
    expect(integrationsService.completeOauth).not.toHaveBeenCalled();
  });

  it("with valid state + redirect > 303 includes returned redirect path", async () => {
    (integrationsService.completeOauth as Mock).mockResolvedValue({
      accountEmail: "u@x",
      redirect: "/custom?x=1",
    });

    const app = buildApp();
    const res = await request(app).get(
      "/api/integrations/google/oauth-callback?code=C&state=S",
    );

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(
      "http://localhost:3000/custom?x=1&connected=1",
    );
  });
});

describe("DELETE /api/integrations/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticated > 200 { data: { ok: true } }", async () => {
    (integrationsService.disconnect as Mock).mockResolvedValue({ ok: true });

    const app = buildApp();
    const res = await request(app)
      .delete("/api/integrations/google")
      .set("x-test-user", "u-1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { ok: true } });
    expect(integrationsService.disconnect).toHaveBeenCalledWith({
      userId: "u-1",
    });
  });

  it("unauthenticated > 401", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/integrations/google");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/integrations/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticated > passes userId to service.getStatus", async () => {
    (integrationsService.getStatus as Mock).mockResolvedValue({
      anthropic: { configured: false, status: "not_configured" },
      gmail: { configured: false, status: "not_configured" },
      drive: { configured: false, status: "not_configured" },
      google: { connected: false },
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/integrations/status")
      .set("x-test-user", "u-1");

    expect(res.status).toBe(200);
    expect(integrationsService.getStatus).toHaveBeenCalledWith("u-1");
    expect(res.body.data.google).toEqual({ connected: false });
  });
});
