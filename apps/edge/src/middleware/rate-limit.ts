import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/context";
import type { RateLimit } from "../env";
import { TooManyRequestsException } from "../lib/errors";

/** Per-client-IP limit using the Workers Rate Limiting binding (replaces express-rate-limit's in-memory store). */
export function rateLimit(pick: (env: AppEnv["Bindings"]) => RateLimit | undefined) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const limiter = pick(c.env);
    if (limiter) {
      const key = c.req.header("cf-connecting-ip") ?? "unknown";
      const { success } = await limiter.limit({ key });
      if (!success) throw new TooManyRequestsException();
    }
    await next();
  });
}
