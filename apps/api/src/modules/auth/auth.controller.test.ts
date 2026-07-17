import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenException } from "@/common/exceptions/http-exception";
import { resolveAuthUserFromToken } from "@/core/guards/auth.guard";
import { errorHandler } from "@/core/middleware/error-handler";
import { supabaseAdmin } from "@/infrastructure/supabase/admin";
import authRoutes from "@/modules/auth/auth.controller";

vi.mock("@/core/guards/auth.guard", () => ({
  authenticate: vi.fn(
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => next(new ForbiddenException("Account deactivated")),
  ),
  requireActive: vi.fn(
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => next(),
  ),
  resolveAuthUserFromToken: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/admin", () => ({
  supabaseAdmin: {
    auth: {
      refreshSession: vi.fn(),
    },
  },
}));

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  return app;
}

function serializedCookies(response: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const value = response.headers["set-cookie"];
  return Array.isArray(value) ? value.join("\n") : (value ?? "");
}

describe("auth session lifecycle controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets refreshed cookies only after local user eligibility succeeds", async () => {
    vi.mocked(supabaseAdmin.auth.refreshSession).mockResolvedValue({
      data: {
        user: null,
        session: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        },
      },
      error: null,
    } as never);
    vi.mocked(resolveAuthUserFromToken).mockResolvedValue({
      id: "user-123",
      email: "person@manut.example",
      name: "Person",
      isActive: true,
      deletedAt: null,
      entityId: "entity-1",
      permissions: [],
    });

    const response = await request(buildApp())
      .post("/api/auth/refresh")
      .set("Cookie", "manut_refresh_token=old-refresh-token")
      .expect(200);

    expect(resolveAuthUserFromToken).toHaveBeenCalledWith("new-access-token");
    expect(serializedCookies(response)).toContain(
      "manut_access_token=new-access-token",
    );
    expect(serializedCookies(response)).toContain(
      "manut_refresh_token=new-refresh-token",
    );
  });

  it("clears cookies and rejects refresh when the local user was deleted", async () => {
    vi.mocked(supabaseAdmin.auth.refreshSession).mockResolvedValue({
      data: {
        user: null,
        session: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        },
      },
      error: null,
    } as never);
    vi.mocked(resolveAuthUserFromToken).mockRejectedValue(
      new ForbiddenException("Account deactivated"),
    );

    const response = await request(buildApp())
      .post("/api/auth/refresh")
      .set("Cookie", "manut_refresh_token=old-refresh-token")
      .expect(403);

    const cookies = serializedCookies(response);
    expect(cookies).toContain("manut_access_token=");
    expect(cookies).toContain("manut_refresh_token=");
    expect(cookies).not.toContain("manut_access_token=new-access-token");
    expect(cookies).not.toContain("manut_refresh_token=new-refresh-token");
  });

  it("always clears local cookies on logout even when authentication would reject", async () => {
    const response = await request(buildApp())
      .post("/api/auth/logout")
      .set(
        "Cookie",
        "manut_access_token=old-access-token; manut_refresh_token=old-refresh-token",
      )
      .expect(200);

    expect(response.body).toEqual({ success: true });
    const cookies = serializedCookies(response);
    expect(cookies).toContain("manut_access_token=");
    expect(cookies).toContain("manut_refresh_token=");
  });
});
