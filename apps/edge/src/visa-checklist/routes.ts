import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";

const VISA_MANAGE = "visa:manage";

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

export function createVisaChecklistRoutes(): Hono<EdgeEnv> {
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

    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/visa-checklist/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Template catalog list only. Writes / per-record checklist stay proxied.
    if (method === "GET" && (path === "/templates" || path === "/templates/")) {
      const connectionString = hyperdriveConnectionString(context.env);
      const { createPrismaClient } = await import("@manut/database");
      const { loadUserPermissions } = await import("../rbac");
      const client = createPrismaClient(connectionString);
      const userId = context.get("principal").subject;
      const permissions = await loadUserPermissions(client, userId, [
        VISA_MANAGE,
      ]);
      if (!permissions.has(VISA_MANAGE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const rows = await client.visaChecklistTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ visaType: "asc" }, { name: "asc" }],
        select: {
          id: true,
          visaType: true,
          country: true,
          name: true,
          items: true,
          isActive: true,
        },
      });

      return context.json({
        data: rows.map((row) => ({
          id: row.id,
          visaType: row.visaType,
          country: row.country,
          name: row.name,
          items: Array.isArray(row.items) ? row.items : [],
          isActive: row.isActive,
        })),
      });
    }

    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
