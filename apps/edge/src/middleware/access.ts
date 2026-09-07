import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/context";
import { UnauthorizedException } from "../lib/errors";
import { accessIsConfigured, evaluateAccessJwt, readAccessAssertion } from "../lib/access";

const OPEN_PREFIXES = ["/api/health"];

/** Fail-open unless CF_ACCESS_AUD is set. Then require a Cloudflare Access JWT. */
export const requireAccess = createMiddleware<AppEnv>(async (c, next) => {
  if (!accessIsConfigured(c.env)) return next();
  if (OPEN_PREFIXES.some((prefix) => c.req.path === prefix || c.req.path.startsWith(`${prefix}/`))) {
    return next();
  }
  const token = readAccessAssertion(c.req.raw.headers);
  if (!token) throw new UnauthorizedException("Cloudflare Access assertion required");
  const result = evaluateAccessJwt(token, c.env);
  if (!result.ok) throw new UnauthorizedException("Cloudflare Access assertion invalid");
  await next();
});
