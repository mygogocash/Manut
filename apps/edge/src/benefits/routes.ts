import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";

const BENEFITS_READ = "benefits:read";

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

function money(value: { toNumber?: () => number } | number | string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value.toNumber === "function") return String(value.toNumber());
  return String(value);
}

export function createBenefitsRoutes(): Hono<EdgeEnv> {
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
      /^\/api\/benefits/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Catalog list only. Enrollments / manage writes stay on Express.
    if (method === "GET" && (path === "" || path === "/")) {
      const connectionString = hyperdriveConnectionString(context.env);
      const { createPrismaClient } = await import("@manut/database");
      const { loadUserPermissions } = await import("../rbac");
      const client = createPrismaClient(connectionString);
      const userId = context.get("principal").subject;
      const permissions = await loadUserPermissions(client, userId, [
        BENEFITS_READ,
        "benefits:enroll",
        "benefits:manage",
      ]);
      if (!permissions.has(BENEFITS_READ)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const category = context.req.query("category")?.trim() || undefined;
      const entityId = context.req.query("entityId")?.trim() || undefined;

      const where: {
        isActive: boolean;
        category?: string;
        entityId?: string;
      } = { isActive: true };
      if (category) where.category = category;
      if (entityId) where.entityId = entityId;

      const [rows, total] = await Promise.all([
        client.benefit.findMany({
          where,
          include: {
            entity: { select: { id: true, name: true } },
            _count: { select: { enrollments: true } },
          },
          orderBy: { name: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.benefit.count({ where }),
      ]);

      return context.json({
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          description: row.description,
          provider: row.provider,
          cost: money(row.cost),
          currency: row.currency,
          isActive: row.isActive,
          entity: row.entity,
          _count: row._count,
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
