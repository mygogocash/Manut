import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ForbiddenException } from "@/common/exceptions/http-exception";
import {
  authenticate,
  requireActive,
  resolveAuthUserFromToken,
} from "@/core/guards/auth.guard";
import { prisma } from "@/infrastructure/database/prisma";
import { supabaseAdmin } from "@/infrastructure/supabase/admin";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/infrastructure/supabase/admin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock("@/lib/events", () => ({
  trackPermissionDenied: vi.fn(),
}));

describe("auth guard local-user eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseAdmin.auth.getUser as Mock).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
  });

  it("resolves an active, non-deleted local user", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      id: "user-123",
      email: "person@manut.example",
      name: "Person",
      isActive: true,
      deletedAt: null,
      entityId: "entity-1",
    });

    await expect(resolveAuthUserFromToken("valid-token")).resolves.toEqual({
      id: "user-123",
      email: "person@manut.example",
      name: "Person",
      isActive: true,
      deletedAt: null,
      entityId: "entity-1",
      permissions: [],
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        deletedAt: true,
        entityId: true,
      },
    });
  });

  it("rejects a soft-deleted local user even when the provider session and active flag remain valid", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      id: "user-123",
      email: "person@manut.example",
      name: "Person",
      isActive: true,
      deletedAt: new Date("2026-07-17T00:00:00.000Z"),
      entityId: "entity-1",
    });

    await expect(resolveAuthUserFromToken("valid-token")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("preserves the forbidden eligibility result through authenticate", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      id: "user-123",
      email: "person@manut.example",
      name: "Person",
      isActive: true,
      deletedAt: new Date("2026-07-17T00:00:00.000Z"),
      entityId: "entity-1",
    });
    const req = {
      headers: { authorization: "Bearer valid-token" },
      cookies: {},
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenException));
  });

  it("rejects a deleted principal passed to the active-account guard", async () => {
    const req = {
      user: {
        id: "user-123",
        email: "person@manut.example",
        name: "Person",
        isActive: true,
        deletedAt: new Date("2026-07-17T00:00:00.000Z"),
        entityId: "entity-1",
        permissions: [],
      },
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await requireActive(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenException));
  });
});
