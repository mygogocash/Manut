import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, resolveHyperdriveRouteMode } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import {
  looksManagedStorageUrl,
  resolveTrustedStorageOrigins,
} from "../trusted-storage";
import { createExpensesService } from "./service";
import type { ExpensesStore } from "./store";

export type CreateExpensesStore = (
  env: RuntimeBindings,
) => ExpensesStore | Promise<ExpensesStore>;

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

/**
 * Managed receipt URLs need TRUSTED_STORAGE_ORIGINS on the Worker.
 * Until that is configured, proxy to Express (parity bridge storage).
 * External (non-managed) receipt links are edge-native with allow-external.
 */
function receiptNeedsProxy(
  env: RuntimeBindings,
  receiptUrl: string | undefined,
): boolean {
  if (!receiptUrl || receiptUrl.trim() === "") return false;
  const trustedOrigins = resolveTrustedStorageOrigins(env);
  if (looksManagedStorageUrl(receiptUrl, trustedOrigins)) {
    return trustedOrigins.length === 0;
  }
  return false;
}

export function createExpensesRoutes(options: {
  createExpensesStore?: CreateExpensesStore;
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

    const store = await resolveStore(context.env, options.createExpensesStore);
    const trustedOrigins = resolveTrustedStorageOrigins(context.env);
    const service = createExpensesService(store, { trustedOrigins });
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/expenses/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Self-scoped list + pendingForMe. HR includeAll stays proxied.
    if (method === "GET" && (path === "/reports" || path === "/reports/")) {
      const url = new URL(context.req.url);
      if (url.searchParams.get("includeAll") === "true") {
        return proxyApiRequest(context.req.raw, context.env);
      }
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const status = context.req.query("status")?.trim() || undefined;
      const period = context.req.query("period")?.trim() || undefined;
      const pendingForMe =
        url.searchParams.get("pendingForMe") === "true";
      return context.json(
        await service.list(userId, {
          page,
          limit,
          status,
          period,
          pendingForMe,
        }),
      );
    }

    if (method === "GET" && (path === "/convert" || path === "/convert/")) {
      const amount = Number(context.req.query("amount"));
      const fromCurrency = context.req.query("fromCurrency") ?? "";
      const toCurrency = context.req.query("toCurrency") ?? "";
      return context.json(
        await service.convert(userId, amount, fromCurrency, toCurrency),
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

    const addLineMatch = /^\/reports\/([^/]+)\/expenses\/?$/u.exec(path);
    if (method === "POST" && addLineMatch) {
      const reportId = decodeURIComponent(addLineMatch[1] ?? "");
      const rawRequest = context.req.raw;
      let bodyText: string;
      try {
        bodyText = await rawRequest.clone().text();
      } catch {
        throw new HttpError(
          400,
          "INVALID_JSON",
          "Request body must be valid JSON.",
        );
      }
      let body: unknown;
      try {
        body = JSON.parse(bodyText) as unknown;
      } catch {
        throw new HttpError(
          400,
          "INVALID_JSON",
          "Request body must be valid JSON.",
        );
      }
      if (typeof body !== "object" || body === null) {
        throw new HttpError(400, "INVALID_EXPENSE", "Request body is required.");
      }
      const record = body as Record<string, unknown>;
      const receiptUrl =
        typeof record.receiptUrl === "string" ? record.receiptUrl : undefined;
      if (receiptNeedsProxy(context.env, receiptUrl)) {
        return proxyApiRequest(
          new Request(rawRequest.url, {
            body: bodyText,
            headers: rawRequest.headers,
            method: rawRequest.method,
          }),
          context.env,
        );
      }

      const result = await service.addLine(userId, reportId, {
        description:
          typeof record.description === "string" ? record.description : "",
        amount: Number(record.amount),
        currency: typeof record.currency === "string" ? record.currency : "THB",
        date: typeof record.date === "string" ? record.date : "",
        categoryId:
          typeof record.categoryId === "string" ? record.categoryId : undefined,
        travelRequestId:
          typeof record.travelRequestId === "string"
            ? record.travelRequestId
            : undefined,
        notes: typeof record.notes === "string" ? record.notes : undefined,
        receiptUrl:
          record.receiptUrl === null
            ? null
            : typeof record.receiptUrl === "string"
              ? record.receiptUrl
              : undefined,
      });
      return context.json(result, 201);
    }

    const lineMatch = /^\/reports\/([^/]+)\/expenses\/([^/]+)\/?$/u.exec(path);
    if (lineMatch) {
      const reportId = decodeURIComponent(lineMatch[1] ?? "");
      const expenseId = decodeURIComponent(lineMatch[2] ?? "");

      if (method === "PUT") {
        const rawRequest = context.req.raw;
        let bodyText: string;
        try {
          bodyText = await rawRequest.clone().text();
        } catch {
          throw new HttpError(
            400,
            "INVALID_JSON",
            "Request body must be valid JSON.",
          );
        }
        let body: unknown;
        try {
          body = JSON.parse(bodyText) as unknown;
        } catch {
          throw new HttpError(
            400,
            "INVALID_JSON",
            "Request body must be valid JSON.",
          );
        }
        if (typeof body !== "object" || body === null) {
          throw new HttpError(
            400,
            "INVALID_EXPENSE",
            "Request body is required.",
          );
        }
        const record = body as Record<string, unknown>;
        const receiptUrl =
          typeof record.receiptUrl === "string" ? record.receiptUrl : undefined;
        if (receiptNeedsProxy(context.env, receiptUrl)) {
          return proxyApiRequest(
            new Request(rawRequest.url, {
              body: bodyText,
              headers: rawRequest.headers,
              method: rawRequest.method,
            }),
            context.env,
          );
        }

        return context.json(
          await service.updateLine(userId, reportId, expenseId, {
            description:
              typeof record.description === "string"
                ? record.description
                : undefined,
            amount:
              record.amount !== undefined ? Number(record.amount) : undefined,
            currency:
              typeof record.currency === "string" ? record.currency : undefined,
            date: typeof record.date === "string" ? record.date : undefined,
            categoryId:
              record.categoryId === null
                ? null
                : typeof record.categoryId === "string"
                  ? record.categoryId
                  : undefined,
            notes:
              record.notes === null
                ? null
                : typeof record.notes === "string"
                  ? record.notes
                  : undefined,
            receiptUrl:
              record.receiptUrl === null
                ? null
                : typeof record.receiptUrl === "string"
                  ? record.receiptUrl
                  : undefined,
          }),
        );
      }

      if (method === "DELETE") {
        return context.json(
          await service.removeLine(userId, reportId, expenseId),
        );
      }
    }

    const submitMatch = /^\/reports\/([^/]+)\/submit\/?$/u.exec(path);
    if (method === "POST" && submitMatch) {
      const reportId = decodeURIComponent(submitMatch[1] ?? "");
      return context.json(await service.submit(userId, reportId));
    }

    const approveMatch = /^\/reports\/([^/]+)\/approve\/?$/u.exec(path);
    if (method === "POST" && approveMatch) {
      const reportId = decodeURIComponent(approveMatch[1] ?? "");
      let record: Record<string, unknown> = {};
      try {
        const body = await context.req.json();
        if (typeof body === "object" && body !== null) {
          record = body as Record<string, unknown>;
        }
      } catch {
        // Empty / missing body means approve the full running total.
      }
      return context.json(
        await service.approve(userId, reportId, {
          approvedAmount:
            record.approvedAmount !== undefined
              ? Number(record.approvedAmount)
              : undefined,
          notes: typeof record.notes === "string" ? record.notes : undefined,
        }),
      );
    }

    const rejectMatch = /^\/reports\/([^/]+)\/reject\/?$/u.exec(path);
    if (method === "POST" && rejectMatch) {
      const reportId = decodeURIComponent(rejectMatch[1] ?? "");
      const body = await readJsonBody(context);
      if (typeof body !== "object" || body === null) {
        throw new HttpError(400, "INVALID_EXPENSE", "Request body is required.");
      }
      const record = body as Record<string, unknown>;
      const reason = typeof record.reason === "string" ? record.reason : "";
      return context.json(await service.reject(userId, reportId, reason));
    }

    // Reimburse, payroll, meta, raw items, includeAll stay on Express.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
