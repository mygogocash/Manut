import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { supabaseAdmin } from "@/infrastructure/supabase/admin";
import { AuthService } from "@/modules/auth/auth.service";

vi.mock("../../infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // Implicit manager-perm helper queries this; default to 0 reports
      // so existing tests stay manager-free.
      count: vi.fn().mockResolvedValue(0),
    },
    role: {
      findFirst: vi.fn(),
    },
    userRole: {
      createMany: vi.fn(),
      // Magic-link role gate calls findMany. The feature is disabled
      // by default in prod (MAGIC_LINK_ALLOWED_ROLES = ""), so default
      // the stub to the system Admin role — Admin always bypasses.
      // Tests that exercise the gate explicitly override.
      findMany: vi
        .fn()
        .mockResolvedValue([{ role: { name: "Admin", isSystem: true } }]),
    },
    authLog: {
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        user: { create: vi.fn(), findUnique: vi.fn() },
        role: { findFirst: vi.fn() },
        userRole: { createMany: vi.fn() },
      }),
    ),
  },
}));

vi.mock("../../infrastructure/supabase/admin", () => ({
  supabaseAdmin: {
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOtp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      refreshSession: vi.fn(),
      getUser: vi.fn(),
      admin: {
        createUser: vi.fn(),
        updateUserById: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  },
}));

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
    (prisma.authLog.count as Mock).mockResolvedValue(0);
    (prisma.authLog.create as Mock).mockResolvedValue({});
  });

  describe("login", () => {
    const loginInput = { email: "test@example.com", password: "password123" };

    it("should login successfully with valid credentials", async () => {
      const mockAuthData = {
        user: { id: "user-123" },
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          expires_at: 1234567890,
        },
      };

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        department: "Engineering",
        jobTitle: "Developer",
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        entity: { id: "entity-1", name: "Manut" },
        userRoles: [
          {
            role: {
              id: "role-1",
              name: "Employee",
              rolePermissions: [
                { permissionCode: "leave:read" },
                { permissionCode: "leave:request" },
              ],
            },
          },
        ],
      };

      (supabaseAdmin.auth.signInWithPassword as Mock).mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const result = await authService.login(loginInput);

      expect(result.user.id).toBe("user-123");
      expect(result.user.email).toBe("test@example.com");
      expect(result.permissions).toContain("leave:read");
      expect(result.permissions).toContain("leave:request");
      expect(result.session.accessToken).toBe("access-token");
    });

    it("should throw UnauthorizedException for invalid credentials", async () => {
      (supabaseAdmin.auth.signInWithPassword as Mock).mockResolvedValue({
        data: null,
        error: { message: "Invalid login credentials" },
      });

      await expect(authService.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when user not found in database", async () => {
      (supabaseAdmin.auth.signInWithPassword as Mock).mockResolvedValue({
        data: { user: { id: "user-123" }, session: {} },
        error: null,
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(authService.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw ForbiddenException for deactivated user", async () => {
      (supabaseAdmin.auth.signInWithPassword as Mock).mockResolvedValue({
        data: { user: { id: "user-123" }, session: {} },
        error: null,
      });
      (prisma.user.findUnique as Mock).mockResolvedValue({
        id: "user-123",
        isActive: false,
        userRoles: [],
      });

      await expect(authService.login(loginInput)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rejects a soft-deleted user even when Supabase accepts the password", async () => {
      (supabaseAdmin.auth.signInWithPassword as Mock).mockResolvedValue({
        data: {
          user: { id: "user-123" },
          session: {
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
          },
        },
        error: null,
      });
      (prisma.user.findUnique as Mock).mockResolvedValue({
        id: "user-123",
        isActive: true,
        deletedAt: new Date("2026-07-17T00:00:00.000Z"),
        userRoles: [],
      });

      await expect(authService.login(loginInput)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("requestPasswordReset", () => {
    it("sends a reset email only for active intranet users", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue({
        id: "user-123",
        email: "user@manut.example",
        isActive: true,
        deletedAt: null,
      });
      (supabaseAdmin.auth.resetPasswordForEmail as Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await authService.requestPasswordReset(
        { email: " USER@MANUT.EXAMPLE " },
        { ip: "203.0.113.10" },
      );

      expect(supabaseAdmin.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "user@manut.example",
        { redirectTo: expect.stringMatching(/\/reset-password$/) },
      );
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "user@manut.example",
          ip: "203.0.113.10",
          action: "forgot-password",
          success: true,
          userId: "user-123",
        }),
      });
    });

    it("does not reveal missing users or call Supabase for them", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue(null);

      await authService.requestPasswordReset(
        { email: "outside@example.com" },
        { ip: "203.0.113.11" },
      );

      expect(supabaseAdmin.auth.resetPasswordForEmail).not.toHaveBeenCalled();
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "outside@example.com",
          action: "forgot-password",
          success: false,
          errorMessage: "user-not-found",
        }),
      });
    });

    it("rate limits recovery requests by email before sending", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue({
        id: "user-123",
        email: "user@manut.example",
        isActive: true,
        deletedAt: null,
      });
      (prisma.authLog.count as Mock)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);

      await authService.requestPasswordReset({
        email: "user@manut.example",
      });

      expect(supabaseAdmin.auth.resetPasswordForEmail).not.toHaveBeenCalled();
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "forgot-password",
          success: false,
          errorMessage: "email-rate-limited",
        }),
      });
    });

    it("does not send recovery email for a soft-deleted active user", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue({
        id: "user-123",
        email: "user@manut.example",
        isActive: true,
        deletedAt: new Date("2026-07-17T00:00:00.000Z"),
      });

      await authService.requestPasswordReset({
        email: "user@manut.example",
      });

      expect(supabaseAdmin.auth.resetPasswordForEmail).not.toHaveBeenCalled();
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "forgot-password",
          success: false,
          errorMessage: "inactive-user",
          userId: "user-123",
        }),
      });
    });
  });

  describe("requestMagicLink", () => {
    it("uses Supabase OTP without auto-creating users", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue({
        id: "user-123",
        email: "user@manut.example",
        isActive: true,
        deletedAt: null,
      });
      (supabaseAdmin.auth.signInWithOtp as Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await authService.requestMagicLink({
        email: "user@manut.example",
      });

      expect(supabaseAdmin.auth.signInWithOtp).toHaveBeenCalledWith({
        email: "user@manut.example",
        options: {
          shouldCreateUser: false,
          emailRedirectTo: expect.stringMatching(/\/auth\/callback$/),
        },
      });
    });

    it("rejects users without the IT role and logs feature-not-enabled", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue({
        id: "user-456",
        email: "marketer@manut.example",
        isActive: true,
        deletedAt: null,
      });
      // Override the default IT membership for this case — user has
      // only a non-allowed role.
      (prisma.userRole.findMany as Mock).mockResolvedValueOnce([
        { role: { name: "Marketing", isSystem: false } },
      ]);

      await authService.requestMagicLink({
        email: "marketer@manut.example",
      });

      expect(supabaseAdmin.auth.signInWithOtp).not.toHaveBeenCalled();
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "magic-link",
          success: false,
          errorMessage: "feature-not-enabled",
        }),
      });
    });

    it("allows the system Admin role even when not in the allowlist", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue({
        id: "user-789",
        email: "admin@manut.example",
        isActive: true,
        deletedAt: null,
      });
      (prisma.userRole.findMany as Mock).mockResolvedValueOnce([
        { role: { name: "Admin", isSystem: true } },
      ]);
      (supabaseAdmin.auth.signInWithOtp as Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await authService.requestMagicLink({
        email: "admin@manut.example",
      });

      expect(supabaseAdmin.auth.signInWithOtp).toHaveBeenCalled();
    });

    it("does not issue a magic link for a soft-deleted active user", async () => {
      (prisma.user.findFirst as Mock).mockResolvedValue({
        id: "user-123",
        email: "user@manut.example",
        isActive: true,
        deletedAt: new Date("2026-07-17T00:00:00.000Z"),
      });

      await authService.requestMagicLink({ email: "user@manut.example" });

      expect(supabaseAdmin.auth.signInWithOtp).not.toHaveBeenCalled();
      expect(prisma.userRole.findMany).not.toHaveBeenCalled();
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "magic-link",
          success: false,
          errorMessage: "inactive-user",
          userId: "user-123",
        }),
      });
    });
  });

  describe("recoverPassword", () => {
    it("validates link tokens, updates password, clears mustChangePassword, and returns a session", async () => {
      (supabaseAdmin.auth.getUser as Mock)
        .mockResolvedValueOnce({
          data: {
            user: { id: "user-123", email: "user@manut.example" },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            user: { id: "user-123", email: "user@manut.example" },
          },
          error: null,
        });
      (supabaseAdmin.auth.refreshSession as Mock).mockResolvedValue({
        data: {
          session: {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            expires_at: 1234567890,
          },
        },
        error: null,
      });
      (supabaseAdmin.auth.admin.updateUserById as Mock).mockResolvedValue({
        data: {},
        error: null,
      });
      (prisma.user.findUnique as Mock)
        .mockResolvedValueOnce({
          id: "user-123",
          email: "user@manut.example",
          isActive: true,
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          id: "user-123",
          email: "user@manut.example",
          name: "Test User",
          avatarUrl: null,
          department: "Engineering",
          jobTitle: "Developer",
          isActive: true,
          deletedAt: null,
          mustChangePassword: false,
          entity: { id: "entity-1", name: "Manut" },
          userRoles: [],
        });
      (prisma.user.update as Mock).mockResolvedValue({});

      const result = await authService.recoverPassword({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        newPassword: "NewPassword123!",
      });

      expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
        "user-123",
        { password: "NewPassword123!" },
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { mustChangePassword: false },
      });
      expect(result.session.accessToken).toBe("new-access-token");
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "recover-password",
          success: true,
          userId: "user-123",
        }),
      });
    });

    it("rejects password recovery for a soft-deleted active user before changing credentials", async () => {
      (supabaseAdmin.auth.getUser as Mock)
        .mockResolvedValueOnce({
          data: { user: { id: "user-123", email: "user@manut.example" } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { user: { id: "user-123", email: "user@manut.example" } },
          error: null,
        });
      (supabaseAdmin.auth.refreshSession as Mock).mockResolvedValue({
        data: {
          session: {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          },
        },
        error: null,
      });
      (prisma.user.findUnique as Mock).mockResolvedValue({
        id: "user-123",
        email: "user@manut.example",
        isActive: true,
        deletedAt: new Date("2026-07-17T00:00:00.000Z"),
      });

      await expect(
        authService.recoverPassword({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          newPassword: "NewPassword123!",
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("exchangeSession", () => {
    it("rejects a soft-deleted active user after validating the provider tokens", async () => {
      (supabaseAdmin.auth.getUser as Mock)
        .mockResolvedValueOnce({
          data: { user: { id: "user-123", email: "user@manut.example" } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { user: { id: "user-123", email: "user@manut.example" } },
          error: null,
        });
      (supabaseAdmin.auth.refreshSession as Mock).mockResolvedValue({
        data: {
          session: {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          },
        },
        error: null,
      });
      (prisma.user.findUnique as Mock).mockResolvedValue({
        id: "user-123",
        email: "user@manut.example",
        isActive: true,
        deletedAt: new Date("2026-07-17T00:00:00.000Z"),
      });

      await expect(
        authService.exchangeSession({
          accessToken: "access-token",
          refreshToken: "refresh-token",
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "exchange-session",
          success: false,
          errorMessage: "inactive-user",
          userId: "user-123",
        }),
      });
    });
  });

  describe("getMe", () => {
    it("should return user with permissions", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        department: "Engineering",
        jobTitle: "Developer",
        mustChangePassword: false,
        entity: { id: "entity-1", name: "Manut" },
        userRoles: [
          {
            role: {
              rolePermissions: [{ permissionCode: "admin:read" }],
            },
          },
        ],
      };

      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const result = await authService.getMe("user-123");

      expect(result.user.id).toBe("user-123");
      expect(result.permissions).toContain("admin:read");
    });

    it("maps legacy permission codes to canonical catalog codes", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        department: null,
        jobTitle: null,
        mustChangePassword: false,
        entity: null,
        userRoles: [
          {
            role: {
              rolePermissions: [
                { permissionCode: "expenses:read" },
                { permissionCode: "leave:create" },
              ],
            },
          },
        ],
      };

      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const result = await authService.getMe("user-123");

      expect(result.permissions).toContain("expense:read");
      expect(result.permissions).toContain("leave:request");
      expect(result.permissions).not.toContain("expenses:read");
    });

    it("should throw UnauthorizedException when user not found", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(authService.getMe("user-123")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("grants every permission code when user has the system Admin role", async () => {
      const mockUser = {
        id: "admin-1",
        email: "admin@manut.example",
        name: "Admin",
        avatarUrl: null,
        department: null,
        jobTitle: null,
        mustChangePassword: false,
        entity: null,
        userRoles: [
          {
            role: {
              id: "role-admin",
              name: "Admin",
              isSystem: true,
              defaultRoute: "/dashboard",
              // Intentionally empty: bypass should ignore the explicit
              // role-permission rows and grant the full catalog.
              rolePermissions: [],
            },
          },
        ],
      };

      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const result = await authService.getMe("admin-1");

      // crm:* perms ship with Sales CRM v2 — they should appear without any
      // role-permission rows because the system Admin bypass kicks in.
      expect(result.permissions).toContain("crm:read");
      expect(result.permissions).toContain("crm:admin");
      // Spot-check a few unrelated modules to confirm the bypass is total.
      expect(result.permissions).toContain("admin:manage");
      expect(result.permissions).toContain("payroll:read");
    });

    it("does not grant the bypass when name is Admin but isSystem is false", async () => {
      const mockUser = {
        id: "user-2",
        email: "user@example.com",
        name: "User",
        avatarUrl: null,
        department: null,
        jobTitle: null,
        mustChangePassword: false,
        entity: null,
        userRoles: [
          {
            role: {
              id: "role-2",
              name: "Admin",
              isSystem: false,
              defaultRoute: "/dashboard",
              rolePermissions: [{ permissionCode: "leave:read" }],
            },
          },
        ],
      };

      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const result = await authService.getMe("user-2");

      expect(result.permissions).toEqual(["leave:read"]);
      expect(result.permissions).not.toContain("crm:read");
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      (supabaseAdmin.auth.admin.updateUserById as Mock).mockResolvedValue({
        data: {},
        error: null,
      });
      (prisma.user.update as Mock).mockResolvedValue({});

      await authService.resetPassword("user-123", "NewPassword123!");

      expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
        "user-123",
        { password: "NewPassword123!" },
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { mustChangePassword: true },
      });
    });

    it("should throw BadRequestException when password reset fails", async () => {
      (supabaseAdmin.auth.admin.updateUserById as Mock).mockResolvedValue({
        data: null,
        error: { message: "Password too weak" },
      });

      await expect(
        authService.resetPassword("user-123", "weak"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getMyProfile", () => {
    it("selects and returns only the public entity identity", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue({
        id: "user-123",
        email: "person@manut.example",
        name: "Person",
        avatarUrl: null,
        isActive: true,
        mustChangePassword: false,
        phone: null,
        phonePublic: false,
        department: "Operations",
        jobTitle: "Coordinator",
        employeeId: "MNT-001",
        employmentType: "full_time",
        startDate: null,
        endDate: null,
        location: null,
        country: null,
        timezone: null,
        entity: {
          id: "entity-1",
          name: "Manut",
          code: "MNT",
          taxId: "must-not-leak",
          address: "must-not-leak",
        },
        userRoles: [{ role: { id: "role-1", name: "Employee" } }],
      });

      const result = await authService.getMyProfile("user-123");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" },
        include: {
          entity: { select: { id: true, name: true, code: true } },
          userRoles: {
            include: { role: { select: { id: true, name: true } } },
          },
        },
      });
      expect(result.profile.entity).toEqual({
        id: "entity-1",
        name: "Manut",
        code: "MNT",
      });
      expect(result.profile.entity).not.toHaveProperty("taxId");
    });
  });

  describe("updateMyProfile", () => {
    it("preserves false, clears empty text, and selects only response fields", async () => {
      (prisma.user.update as Mock).mockResolvedValue({
        id: "user-123",
        email: "person@manut.example",
        name: "Person",
        avatarUrl: null,
        phone: null,
        phonePublic: false,
        location: null,
        country: null,
        timezone: null,
      });

      const result = await authService.updateMyProfile("user-123", {
        phone: "",
        phonePublic: false,
        location: "",
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { phone: null, phonePublic: false, location: null },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          phone: true,
          phonePublic: true,
          location: true,
          country: true,
          timezone: true,
        },
      });
      expect(result).toEqual({
        id: "user-123",
        email: "person@manut.example",
        name: "Person",
        avatarUrl: null,
        phone: null,
        phonePublic: false,
        location: null,
        country: null,
        timezone: null,
      });
    });
  });
});
