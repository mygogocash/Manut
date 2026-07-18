import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";

const VISA_MANAGE = "visa:manage";

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function createVisaKbRoutes(): Hono<EdgeEnv> {
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
      /^\/api\/visa-kb/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Catalog list only. Writes / for-record / detail stay on Express.
    if (method === "GET" && (path === "" || path === "/")) {
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

      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );

      const [rows, total] = await Promise.all([
        client.visaKnowledgeArticle.findMany({
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            title: true,
            slug: true,
            country: true,
            visaType: true,
            tags: true,
            isActive: true,
            updatedAt: true,
          },
        }),
        client.visaKnowledgeArticle.count({ where: { isActive: true } }),
      ]);

      return context.json({
        data: rows.map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          country: row.country,
          visaType: row.visaType,
          tags: row.tags,
          isActive: row.isActive,
          updatedAt: asIso(row.updatedAt),
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
