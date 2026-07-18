import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { createProjectsService } from "./service";
import type { ProjectsStore } from "./store";

export type CreateProjectsStore = (
  env: RuntimeBindings,
) => ProjectsStore | Promise<ProjectsStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateProjectsStore,
): Promise<ProjectsStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveProjectsStore } = await import("./prisma-store");
  return createHyperdriveProjectsStore(env);
}

async function readJsonBody(context: {
  req: { json: () => Promise<unknown> };
}): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Paths that stay on Express even when Hyperdrive is enabled. */
const PROXY_LITERALS = new Set([
  "/dashboard",
  "/import",
  "/import-combined",
  "/reorder",
  "/tasks/export",
  "/tasks/import",
]);

export function createProjectsRoutes(options: {
  createProjectsStore?: CreateProjectsStore;
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

    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/projects/u,
      "",
    );
    const method = context.req.method.toUpperCase();
    const normalized = path.endsWith("/") && path.length > 1
      ? path.slice(0, -1)
      : path;

    if (PROXY_LITERALS.has(normalized)) {
      return proxyApiRequest(context.req.raw, context.env);
    }

    const store = await resolveStore(context.env, options.createProjectsStore);
    const service = createProjectsService(store);
    const userId = context.get("principal").subject;

    if (method === "GET" && (path === "" || path === "/")) {
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const search = context.req.query("search")?.trim() || undefined;
      const status = context.req.query("status")?.trim() || undefined;
      const team = context.req.query("team")?.trim() || undefined;
      return context.json(
        await service.list(userId, { page, limit, search, status, team }),
      );
    }

    const taskCreateMatch = /^\/([^/]+)\/tasks\/?$/u.exec(path);
    if (method === "POST" && taskCreateMatch) {
      const projectId = decodeURIComponent(taskCreateMatch[1] ?? "");
      const body = await readJsonBody(context);
      if (typeof body !== "object" || body === null) {
        throw new HttpError(400, "INVALID_TASK", "Request body is required.");
      }
      const record = body as Record<string, unknown>;
      const result = await service.createTask(userId, projectId, {
        title: optionalString(record.title) ?? "",
        status: optionalString(record.status),
        priority: optionalString(record.priority),
      });
      return context.json(result, 201);
    }

    const idMatch = /^\/([^/]+)\/?$/u.exec(path);
    if (method === "GET" && idMatch) {
      const projectId = decodeURIComponent(idMatch[1] ?? "");
      return context.json(await service.getById(userId, projectId));
    }

    // Create/update/delete, reorder, members, milestones, etc. stay on Express.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
