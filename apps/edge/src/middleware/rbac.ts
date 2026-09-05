import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/context";
import { ForbiddenException, UnauthorizedException } from "../lib/errors";

/**
 * Port of apps/api auth.guard `requirePermission`: passes when the user holds ANY
 * of the given codes. System Admin already holds every code via the resolver, so
 * there is no separate bypass here (CLAUDE.md: don't replicate the bypass in guards).
 */
export function requirePermission(...codes: string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.var.user;
    if (!user) throw new UnauthorizedException();
    if (!user.isActive) throw new ForbiddenException("Account is inactive");
    const held = new Set(user.permissions);
    if (!codes.some((code) => held.has(code))) {
      console.warn(JSON.stringify({ level: "warn", event: "permission_denied", userId: user.id, required: codes[0], path: c.req.path }));
      throw new ForbiddenException("Permission denied");
    }
    await next();
  });
}

/** "Super admin only" is an identity check, never a permission code (any code can be granted to a custom role). */
export const requireSystemAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.var.user;
  if (!user) throw new UnauthorizedException();
  if (!user.isActive) throw new ForbiddenException("Account is inactive");
  if (!user.isSystemAdmin) throw new ForbiddenException("System administrator access required");
  await next();
});
