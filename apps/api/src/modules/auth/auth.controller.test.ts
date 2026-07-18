import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenException } from "@/common/exceptions/http-exception";
import { resolveAuthUserFromToken } from "@/core/guards/auth.guard";
import { errorHandler } from "@/core/middleware/error-handler";
import { supabaseAdmin } from "@/infrastructure/supabase/admin";
import authRoutes from "@/modules/auth/auth.controller";
import { authService } from "@/modules/auth/auth.service";

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

vi.mock("@/modules/auth/auth.service", () => ({
  authService: {
    login: vi.fn(),
    exchangeSession: vi.fn(),
    recoverPassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    requestMagicLink: vi.fn(),
    getMe: vi.fn(),
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

const LOGIN_RESULT = {
  user: {
    id: "user-123",
    email: "person@manut.example",
    name: "Person",
    avatarUrl: null,
    department: null,
    jobTitle: null,
    entity: null,
    mustChangePassword: false,
  },
  roles: [],
  permissions: [],
  session: {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresIn: 3600,
    expiresAt: 1_700_000_000,
  },
};

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

  it("keeps web login cookie-only (no session tokens in JSON body)", async () => {
    vi.mocked(authService.login).mockResolvedValue(LOGIN_RESULT as never);

    const response = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "person@manut.example", password: "password" })
      .expect(200);

    expect(response.body).toEqual({
      user: LOGIN_RESULT.user,
      roles: LOGIN_RESULT.roles,
      permissions: LOGIN_RESULT.permissions,
    });
    expect(response.body).not.toHaveProperty("session");
    expect(serializedCookies(response)).toContain("manut_access_token=");
  });

  it("returns bearer session tokens for native clients (X-Manut-Client)", async () => {
    vi.mocked(authService.login).mockResolvedValue(LOGIN_RESULT as never);

    const response = await request(buildApp())
      .post("/api/auth/login")
      .set("X-Manut-Client", "native")
      .send({ email: "person@manut.example", password: "password" })
      .expect(200);

    expect(response.body).toMatchObject({
      user: LOGIN_RESULT.user,
      session: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
      },
    });
  });

  it("refreshes from JSON body refreshToken for native clients", async () => {
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
      .set("X-Manut-Client", "native")
      .send({ refreshToken: "body-refresh-token" })
      .expect(200);

    expect(supabaseAdmin.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: "body-refresh-token",
    });
    expect(response.body).toMatchObject({
      success: true,
      session: {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: 3600,
      },
    });
  });
});
