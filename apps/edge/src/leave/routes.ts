import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { createLeaveService } from "./service";
import type { LeaveStore } from "./store";

export type CreateLeaveStore = (
  env: RuntimeBindings,
) => LeaveStore | Promise<LeaveStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateLeaveStore,
): Promise<LeaveStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveLeaveStore } = await import("./prisma-store");
  return createHyperdriveLeaveStore(env);
}

export function createLeaveRoutes(options: {
  createLeaveStore?: CreateLeaveStore;
} = {}): Hono<EdgeEnv> {
  const app = new Hono<EdgeEnv>();

  app.all("/*", async (context) => {
    if (!hyperdriveBoundaryRequested(context.env)) {
      return proxyApiRequest(context.req.raw, context.env);
    }

    if (!isHyperdriveEnabled(context.env)) {
      throw new HttpError(
        503,
        "HYPERDRIVE_NOT_PROVISIONED",
        "Database capability is disabled.",
      );
    }

    const store = await resolveStore(context.env, options.createLeaveStore);
    const service = createLeaveService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(/^\/api\/leave/u, "");
    const method = context.req.method.toUpperCase();

    // Self-scoped list only. Create/balance/approval/team stay proxied.
    if (method === "GET" && (path === "/requests" || path === "/requests/")) {
      const employeeId = context.req.query("employeeId")?.trim();
      if (employeeId && employeeId !== userId) {
        return proxyApiRequest(context.req.raw, context.env);
      }
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const status = context.req.query("status")?.trim() || undefined;
      return context.json(
        await service.list(userId, { page, limit, status }),
      );
    }

    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
