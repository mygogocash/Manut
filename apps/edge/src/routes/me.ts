import { Hono } from "hono";
import { getMe } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { UnauthorizedException } from "../lib/errors";

/**
 * `/api/auth/me` — same payload as Express auth.controller GET /me so the
 * Expo AuthProvider / useAuth().refreshUser ports unchanged.
 */
export const me = new Hono<AppEnv>().get("/", requireAuth, async (c) => {
  const user = c.var.user!;
  try {
    const payload = await getMe(c.var.db, user.id);
    return c.json(payload);
  } catch (e) {
    if (e instanceof Error && e.message === "USER_NOT_FOUND") {
      throw new UnauthorizedException("User not found");
    }
    throw e;
  }
});
