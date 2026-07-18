import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, resolveHyperdriveRouteMode } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { VISA_HR_READ, VISA_MANAGE } from "./access";
import { createVisaService } from "./service";
import type { VisaStore } from "./store";

export type CreateVisaStore = (
  env: RuntimeBindings,
) => VisaStore | Promise<VisaStore>;

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateVisaStore,
): Promise<VisaStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveVisaStore } = await import("./prisma-store");
  return createHyperdriveVisaStore(env);
}

export function createVisaRoutes(options: {
  createVisaStore?: CreateVisaStore;
} = {}): Hono<EdgeEnv> {
  const app = new Hono<EdgeEnv>();

  app.all("/*", async (context) => {
    const hyperdriveMode = resolveHyperdriveRouteMode(context.env);
    if (hyperdriveMode === "proxy") {
      return proxyApiRequest(context.req.raw, context.env);
    }
    if (hyperdriveMode === "fail_closed") {
      throw new HttpError(
        503,
        "HYPERDRIVE_NOT_PROVISIONED",
        "Database capability is disabled.",
      );
    }

    const store = await resolveStore(context.env, options.createVisaStore);
    const service = createVisaService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(/^\/api\/visa/u, "");
    const method = context.req.method.toUpperCase();

    // Self-scoped employee list only. HR company-wide + detail/download stay proxied.
    if (method === "GET" && (path === "" || path === "/")) {
      const permissions = await store.loadPermissions(userId);
      if (permissions.has(VISA_HR_READ) || permissions.has(VISA_MANAGE)) {
        return proxyApiRequest(context.req.raw, context.env);
      }
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const status = context.req.query("status")?.trim() || undefined;
      const search = context.req.query("search")?.trim() || undefined;
      return context.json(
        await service.list(userId, { page, limit, status, search }),
      );
    }

    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
