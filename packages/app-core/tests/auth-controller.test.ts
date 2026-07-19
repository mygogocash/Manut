import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/api/api-error";
import { AuthController } from "../src/auth/auth-controller";
import type { AuthGateway } from "../src/auth/auth-ports";
import type { AuthSession } from "../src/auth/auth-types";

const ADMIN_SESSION: AuthSession = {
  user: {
    id: "admin-1",
    email: "admin@manut.example",
    name: "Manut Admin",
    avatarUrl: null,
    department: "Operations",
    jobTitle: "Administrator",
    entity: null,
    mustChangePassword: false,
  },
  roles: [{ id: "role-1", name: "Admin", defaultRoute: null }],
  permissions: ["home:read"],
};

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    login: vi.fn().mockResolvedValue(ADMIN_SESSION),
    getMe: vi.fn().mockResolvedValue(ADMIN_SESSION),
    logout: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue({
      success: true,
      message: "Request accepted.",
    }),
    requestMagicLink: vi.fn().mockResolvedValue({
      success: true,
      message: "Request accepted.",
    }),
    recoverPassword: vi.fn().mockResolvedValue(ADMIN_SESSION),
    exchangeSession: vi.fn().mockResolvedValue(ADMIN_SESSION),
    changePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AuthController", () => {
  it("preserves an authenticated session on transient verification failure", async () => {
    const authGateway = gateway();
    const controller = new AuthController(authGateway);
    await controller.login("admin@manut.example", "secret");
    vi.mocked(authGateway.getMe).mockRejectedValueOnce(
      new ApiError(503, "UNAVAILABLE", "Temporarily unavailable"),
    );

    await controller.verifySession();

    expect(controller.getState()).toMatchObject({
      status: "authenticated",
      user: { id: "admin-1" },
      sessionVerificationError: {
        code: "VERIFICATION_FAILED",
        status: 503,
        retryable: true,
      },
    });
  });

  it("blocks a cold start behind a retryable verification error", async () => {
    const controller = new AuthController(
      gateway({
        getMe: vi
          .fn()
          .mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "Offline")),
      }),
    );

    await controller.verifySession();

    expect(controller.getState()).toMatchObject({
      status: "anonymous",
      user: null,
      sessionVerificationError: {
        code: "NETWORK_ERROR",
        retryable: true,
      },
    });
  });

  it.each([401, 403])("clears state for terminal status %s", async (status) => {
    const authGateway = gateway();
    const controller = new AuthController(authGateway);
    await controller.login("admin@manut.example", "secret");
    vi.mocked(authGateway.getMe).mockRejectedValueOnce(
      new ApiError(status, "AUTH", "Session expired"),
    );

    await controller.verifySession();

    expect(controller.getState()).toEqual({
      status: "anonymous",
      user: null,
      roles: [],
      permissions: [],
      sessionVerificationError: null,
    });
    expect(authGateway.logout).toHaveBeenCalledOnce();
  });

  it("gives password change precedence over the return path", async () => {
    const controller = new AuthController(
      gateway({
        login: vi.fn().mockResolvedValue({
          ...ADMIN_SESSION,
          user: { ...ADMIN_SESSION.user, mustChangePassword: true },
        }),
      }),
    );

    await expect(
      controller.login("admin@manut.example", "secret", "/leave?tab=mine"),
    ).resolves.toBe("/change-password");
  });

  it("accepts a verified link session and applies password-change precedence", async () => {
    const authGateway = gateway({
      exchangeSession: vi.fn().mockResolvedValue({
        ...ADMIN_SESSION,
        user: { ...ADMIN_SESSION.user, mustChangePassword: true },
      }),
    });
    const controller = new AuthController(authGateway);

    await expect(
      controller.exchangeSession({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      }),
    ).resolves.toBe("/change-password");
    expect(controller.getState()).toMatchObject({
      status: "authenticated",
      user: { mustChangePassword: true },
    });
  });

  it("changes the password, creates a fresh session, and returns the default route", async () => {
    const authGateway = gateway();
    const controller = new AuthController(authGateway);
    await controller.login("admin@manut.example", "old-password");

    await expect(
      controller.changePassword("old-password", "new-password"),
    ).resolves.toBe("/dashboard");
    expect(authGateway.changePassword).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "new-password",
    });
    expect(authGateway.login).toHaveBeenLastCalledWith(
      "admin@manut.example",
      "new-password",
    );
  });
});
