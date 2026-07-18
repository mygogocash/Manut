import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { createExpensesService } from "./service";
import type { ExpensesStore } from "./store";

export type CreateExpensesStore = (
  env: RuntimeBindings,
) => ExpensesStore | Promise<ExpensesStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateExpensesStore,
): Promise<ExpensesStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveExpensesStore } = await import("./prisma-store");
  return createHyperdriveExpensesStore(env);
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

export function createExpensesRoutes(options: {
  createExpensesStore?: CreateExpensesStore;
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

    const store = await resolveStore(context.env, options.createExpensesStore);
    const service = createExpensesService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/expenses/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Self-scoped list only. HR includeAll / pendingForMe stay proxied.
    if (method === "GET" && (path === "/reports" || path === "/reports/")) {
      const url = new URL(context.req.url);
      if (
        url.searchParams.get("includeAll") === "true" ||
        url.searchParams.get("pendingForMe") === "true"
      ) {
        return proxyApiRequest(context.req.raw, context.env);
      }
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const status = context.req.query("status")?.trim() || undefined;
      const period = context.req.query("period")?.trim() || undefined;
      return context.json(
        await service.list(userId, { page, limit, status, period }),
      );
    }

    if (method === "POST" && (path === "/reports" || path === "/reports/")) {
      const body = await readJsonBody(context);
      if (typeof body !== "object" || body === null) {
        throw new HttpError(400, "INVALID_EXPENSE", "Request body is required.");
      }
      const record = body as Record<string, unknown>;
      const result = await service.create(userId, {
        entityId: typeof record.entityId === "string" ? record.entityId : "",
        period: typeof record.period === "string" ? record.period : "",
        title: typeof record.title === "string" ? record.title : "",
        category:
          typeof record.category === "string" ? record.category : undefined,
        notes: typeof record.notes === "string" ? record.notes : undefined,
      });
      return context.json(result, 201);
    }

    const detailMatch = /^\/reports\/([^/]+)\/?$/u.exec(path);
    if (method === "GET" && detailMatch) {
      const reportId = decodeURIComponent(detailMatch[1] ?? "");
      try {
        return context.json(await service.getOwn(userId, reportId));
      } catch (error) {
        if (
          error instanceof HttpError &&
          error.code === "EXPENSE_DETAIL_NOT_SELF"
        ) {
          return proxyApiRequest(context.req.raw, context.env);
        }
        throw error;
      }
    }

    // Lines, submit, approvals, raw expense items, meta stay on Express.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
