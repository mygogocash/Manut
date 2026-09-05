import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/context";

/** Structured JSON access log (Workers Logs / Logpush friendly). */
export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const started = Date.now();
  await next();
  console.log(
    JSON.stringify({
      level: "info",
      msg: "request",
      requestId: c.var.requestId ?? c.req.header("cf-ray") ?? null,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - started,
    }),
  );
});
