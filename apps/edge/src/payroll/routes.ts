import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { isPayrollManager } from "./access";
import { createPayrollService } from "./service";
import type { PayrollStore } from "./store";

export type CreatePayrollStore = (
  env: RuntimeBindings,
) => PayrollStore | Promise<PayrollStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreatePayrollStore,
): Promise<PayrollStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdrivePayrollStore } = await import("./prisma-store");
  return createHyperdrivePayrollStore(env);
}

export function createPayrollRoutes(options: {
  createPayrollStore?: CreatePayrollStore;
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

    const store = await resolveStore(context.env, options.createPayrollStore);
    const service = createPayrollService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/payroll/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Self-scoped runs list only. Managers stay proxied.
    if (method === "GET" && (path === "/runs" || path === "/runs/")) {
      const permissions = await store.loadPermissions(userId);
      if (isPayrollManager(permissions)) {
        return proxyApiRequest(context.req.raw, context.env);
      }
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const status = context.req.query("status")?.trim() || undefined;
      const period = context.req.query("period")?.trim() || undefined;
      const entityId = context.req.query("entityId")?.trim() || undefined;
      return context.json(
        await service.listSelfRuns(userId, {
          page,
          limit,
          status,
          period,
          entityId,
        }),
      );
    }

    // Self my-payslips list JSON. Download/export PDFs stay proxied.
    if (
      method === "GET" &&
      (path === "/my-payslips" || path === "/my-payslips/")
    ) {
      return context.json(await service.listMyPayslips(userId));
    }

    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
