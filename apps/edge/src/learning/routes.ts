import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";

const LEARNING_PERMS = [
  "learning:read",
  "learning:complete",
  "learning:manage",
  "learning:hr-read",
] as const;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

function canReadLearning(permissions: ReadonlySet<string>): boolean {
  return LEARNING_PERMS.some((perm) => permissions.has(perm));
}

export function createLearningRoutes(): Hono<EdgeEnv> {
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
      /^\/api\/learning/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Module catalog list only. Completions / manage stay on Express.
    if (method === "GET" && (path === "/modules" || path === "/modules/")) {
      const connectionString = hyperdriveConnectionString(context.env);
      const { createPrismaClient } = await import("@manut/database");
      const { loadUserPermissions } = await import("../rbac");
      const client = createPrismaClient(connectionString);
      const userId = context.get("principal").subject;
      const permissions = await loadUserPermissions(
        client,
        userId,
        LEARNING_PERMS,
      );
      if (!canReadLearning(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const category = context.req.query("category")?.trim() || undefined;
      const search = context.req.query("search")?.trim() || undefined;

      const where: {
        isActive: boolean;
        category?: string;
        OR?: Array<
          | { title: { contains: string; mode: "insensitive" } }
          | { description: { contains: string; mode: "insensitive" } }
        >;
      } = { isActive: true };
      if (category) where.category = category;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [rows, total] = await Promise.all([
        client.trainingModule.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.trainingModule.count({ where }),
      ]);

      return context.json({
        data: rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category,
          duration: row.duration,
          url: row.url,
          fileUrl: row.fileUrl,
          fileName: row.fileName,
          isMandatory: row.isMandatory,
          isActive: row.isActive,
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
