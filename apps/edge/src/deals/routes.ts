import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { createDealsService } from "./service";
import type { DealsStore } from "./store";

export type CreateDealsStore = (
  env: RuntimeBindings,
) => DealsStore | Promise<DealsStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateDealsStore,
): Promise<DealsStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveDealsStore } = await import("./prisma-store");
  return createHyperdriveDealsStore(env);
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

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function createDealsRoutes(options: {
  createDealsStore?: CreateDealsStore;
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

    const store = await resolveStore(context.env, options.createDealsStore);
    const service = createDealsService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(/^\/api\/deals/u, "");
    const method = context.req.method.toUpperCase();

    // Core app-core paths: list + create. Pipeline/detail/update/delete stay proxied.
    if (method === "GET" && (path === "" || path === "/")) {
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const search = context.req.query("search")?.trim() || undefined;
      const stage = context.req.query("stage")?.trim() || undefined;
      const type = context.req.query("type")?.trim() || undefined;
      return context.json(
        await service.list(userId, { page, limit, search, stage, type }),
      );
    }

    if (method === "POST" && (path === "" || path === "/")) {
      const body = await readJsonBody(context);
      if (typeof body !== "object" || body === null) {
        throw new HttpError(400, "INVALID_DEAL", "Request body is required.");
      }
      const record = body as Record<string, unknown>;
      const company = optionalString(record.company) ?? "";
      const valueRaw = record.value;
      const value =
        typeof valueRaw === "number"
          ? valueRaw
          : typeof valueRaw === "string"
            ? Number(valueRaw)
            : Number.NaN;

      const result = await service.create(userId, {
        company,
        contact: optionalString(record.contact),
        value,
        stage: optionalString(record.stage),
        probability: optionalNumber(record.probability),
        type: optionalString(record.type),
        country: optionalString(record.country),
        partnerId: optionalString(record.partnerId),
        closeDate: optionalString(record.closeDate),
        notes: optionalString(record.notes),
      });
      return context.json(result, 201);
    }

    // Progressive: pipeline, get-by-id, update, delete stay on Express for now.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
