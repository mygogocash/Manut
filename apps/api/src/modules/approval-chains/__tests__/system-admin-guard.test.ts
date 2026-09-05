import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_PERMISSION_CODES } from "@/common/constants/permissions";
import { isSystemAdmin, requireSystemAdmin } from "@/core/guards/auth.guard";
import { prisma } from "@/infrastructure/database/prisma";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    userRole: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/infrastructure/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/events", () => ({ trackPermissionDenied: vi.fn() }));

type M = ReturnType<typeof vi.fn>;
const db = prisma as unknown as { userRole: { findFirst: M } };

// "Super admin only" cannot be expressed as a permission code.
//
// A super admin is granted EVERY code, and any code can also be granted to a
// custom role — so a code can never be exclusive to them. Only the role
// assignment distinguishes them. These tests exist because the wrong version of
// this guard (checking `admin:manage`) looks correct and silently lets any custom
// role holding that code reconfigure an approval chain.

/** Signed in and active by default; pass `null` for an unauthenticated request. */
function ctx(
  user: Partial<{
    id: string;
    isActive: boolean;
    permissions: string[];
  }> | null = {},
) {
  const req = {
    user:
      user === null
        ? undefined
        : {
            id: "u1",
            email: "u@x.com",
            name: "U",
            isActive: true,
            entityId: null,
            permissions: [],
            ...user,
          },
    path: "/api/approval-chains/proposal/steps",
  } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res: {} as Response, next: next as unknown as M };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isSystemAdmin", () => {
  it("matches only the system Admin role, not a same-named custom role", async () => {
    db.userRole.findFirst.mockResolvedValue({ userId: "u1" });
    await expect(isSystemAdmin("u1")).resolves.toBe(true);

    const where = db.userRole.findFirst.mock.calls[0][0].where;
    // isSystem AND the name AND not soft-deleted. Dropping any one of the three
    // would let a custom role called "Admin" through.
    expect(where.role).toMatchObject({
      isSystem: true,
      name: "Admin",
      deletedAt: null,
    });
  });

  it("is false when no such assignment exists", async () => {
    db.userRole.findFirst.mockResolvedValue(null);
    await expect(isSystemAdmin("u1")).resolves.toBe(false);
  });
});

describe("requireSystemAdmin", () => {
  it("passes a system admin through", async () => {
    db.userRole.findFirst.mockResolvedValue({ userId: "u1" });
    const { req, res, next } = ctx();
    await requireSystemAdmin()(req, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  // The whole point of the guard.
  it("refuses somebody holding EVERY permission code but not the role", async () => {
    db.userRole.findFirst.mockResolvedValue(null);
    const { req, res, next } = ctx({
      permissions: [...ALL_PERMISSION_CODES],
    });
    await requireSystemAdmin()(req, res, next as unknown as NextFunction);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.message).toMatch(/system administrator/i);
  });

  it("refuses an admin:manage holder who is not a system admin", async () => {
    db.userRole.findFirst.mockResolvedValue(null);
    const { req, res, next } = ctx({ permissions: ["admin:manage"] });
    await requireSystemAdmin()(req, res, next as unknown as NextFunction);
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  it("rejects an unauthenticated request as 401, not 403", async () => {
    const { req, res, next } = ctx(null);
    await requireSystemAdmin()(req, res, next as unknown as NextFunction);
    // A 401 tells the client the session is the problem; a 403 would not.
    expect(next.mock.calls[0][0].status).toBe(401);
    expect(db.userRole.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a deactivated account before looking up any role", async () => {
    const { req, res, next } = ctx({ isActive: false });
    await requireSystemAdmin()(req, res, next as unknown as NextFunction);
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(db.userRole.findFirst).not.toHaveBeenCalled();
  });

  it("forwards a lookup failure instead of failing open", async () => {
    db.userRole.findFirst.mockRejectedValue(new Error("db down"));
    const { req, res, next } = ctx();
    await requireSystemAdmin()(req, res, next as unknown as NextFunction);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
