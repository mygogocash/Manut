import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./lib/context";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/logger";
import { requestContext } from "./middleware/request-context";
import { resolveSession } from "./middleware/auth";
import { rateLimit } from "./middleware/rate-limit";
import { requireTurnstile } from "./middleware/turnstile";
import { posthogProxy } from "./proxy/posthog";
import { api } from "./routes";
import { NotFoundException } from "./lib/errors";
import { requireAccess } from "./middleware/access";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.use("*", secureHeaders({ crossOriginEmbedderPolicy: false }));

  // Analytics proxy: no DB, no auth.
  app.route("/ingest", posthogProxy);
  app.get("/health", (c) => c.json({ status: "ok", service: "intranet-edge", timestamp: new Date().toISOString() }));

  // API middleware order (plan): requestId → logger → rateLimit → auth session → rbac-on-route.
  // requestId is set inside requestContext (needs Hyperdrive); logger runs after so requestId is present.
  app.use("/api/*", requireAccess);
  app.use("/api/*", requestContext);
  app.use("/api/*", requestLogger);
  app.use("/api/*", rateLimit((env) => env.RATE_LIMITER_GLOBAL));
  app.use("/api/auth/sign-in/*", rateLimit((env) => env.RATE_LIMITER_LOGIN));
  app.use("/api/auth/sign-in/*", requireTurnstile);
  app.use("/api/auth/magic-link/*", requireTurnstile);
  app.use("/api/*", resolveSession);
  app.route("/api", api);
  app.all("/api/*", () => {
    throw new NotFoundException("Route not found");
  });

  // Everything else is the Expo web export (SPA fallback handled by the assets binding).
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
  return app;
}

export type App = ReturnType<typeof createApp>;
