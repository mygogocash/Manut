import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { schema } from "@nexora/db";
import { loadUserPermissions } from "@nexora/auth";
import type { AppEnv, CurrentUser } from "../lib/context";
import { ForbiddenException, UnauthorizedException } from "../lib/errors";

const PERMISSION_CACHE_TTL_SECONDS = 60;

/**
 * Resolves the Better Auth session (cookie or bearer) into `c.var.user` with
 * roles + effective permissions. Permissions are cached in KV for 60 s keyed by
 * user id; role/permission writes call `invalidateUserPermissions` (port of the
 * legacy `refreshUser()` contract).
 */
export const resolveSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user) {
    const db = c.var.db;
    const [row] = await db
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, isActive: schema.users.isActive, entityId: schema.users.entityId })
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id))
      .limit(1);
    if (row) {
      const cacheKey = permissionCacheKey(row.id);
      const cached = await c.env.KV_CACHE.get<Omit<CurrentUser, keyof typeof row>>(cacheKey, "json");
      const rbac = cached ?? (await loadUserPermissions(db, row.id));
      if (!cached) c.executionCtx.waitUntil(c.env.KV_CACHE.put(cacheKey, JSON.stringify(rbac), { expirationTtl: PERMISSION_CACHE_TTL_SECONDS }));
      c.set("user", { ...row, ...rbac });
    }
  }
  await next();
});

export const permissionCacheKey = (userId: string) => `rbac:${userId}`;

export async function invalidateUserPermissions(kv: KVNamespace, userId: string) {
  await kv.delete(permissionCacheKey(userId));
}

/** Route guard: signed in and active. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.var.user;
  if (!user) throw new UnauthorizedException();
  if (!user.isActive) throw new ForbiddenException("Account is inactive");
  await next();
});
