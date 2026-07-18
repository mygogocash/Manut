import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { createCashAdvanceService } from "./service";
import type { CashAdvanceStore } from "./store";

export type CreateCashAdvanceStore = (
  env: RuntimeBindings,
) => CashAdvanceStore | Promise<CashAdvanceStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateCashAdvanceStore,
): Promise<CashAdvanceStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveCashAdvanceStore } = await import("./prisma-store");
  return createHyperdriveCashAdvanceStore(env);
}

export function createCashAdvanceRoutes(options: {
  createCashAdvanceStore?: CreateCashAdvanceStore;
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

    const store = await resolveStore(
      context.env,
      options.createCashAdvanceStore,
    );
    const service = createCashAdvanceService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/cash-advance/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Self-scoped list. scope=all / approval / detail / submit stay proxied.
    if (method === "GET" && (path === "" || path === "/")) {
      const scope = context.req.query("scope")?.trim() || "mine";
      if (scope === "all") {
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

    if (method === "POST" && (path === "" || path === "/")) {
      // Clone before parse so receipt-bearing creates can still proxy upstream.
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
          "INVALID_CASH_ADVANCE",
          "Request body is required.",
        );
      }
      const record = body as Record<string, unknown>;
      const rawItems = Array.isArray(record.items) ? record.items : [];
      const hasReceipt = rawItems.some(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { receiptUrl?: unknown }).receiptUrl === "string" &&
          String((item as { receiptUrl: string }).receiptUrl).trim() !== "",
      );
      if (hasReceipt) {
        return proxyApiRequest(
          new Request(rawRequest.url, {
            body: bodyText,
            headers: rawRequest.headers,
            method: rawRequest.method,
          }),
          context.env,
        );
      }

      const result = await service.create(userId, {
        entityId:
          typeof record.entityId === "string" ? record.entityId : undefined,
        payoutMode:
          typeof record.payoutMode === "string" ? record.payoutMode : "cash",
        bankName:
          typeof record.bankName === "string" ? record.bankName : undefined,
        bankAccountNo:
          typeof record.bankAccountNo === "string"
            ? record.bankAccountNo
            : undefined,
        currency:
          typeof record.currency === "string" ? record.currency : "THB",
        notes: typeof record.notes === "string" ? record.notes : undefined,
        items: rawItems
          .filter(
            (item): item is Record<string, unknown> =>
              typeof item === "object" && item !== null,
          )
          .map((item) => ({
            description:
              typeof item.description === "string" ? item.description : "",
            requestedAmount: Number(item.requestedAmount),
          })),
      });
      return context.json(result, 201);
    }

    const submitMatch = /^\/([^/]+)\/submit\/?$/u.exec(path);
    if (method === "POST" && submitMatch) {
      const requestId = decodeURIComponent(submitMatch[1] ?? "");
      return context.json(await service.submit(userId, requestId));
    }

    // Receipt attach/update, approve, disburse, signed receipt GET stay proxied.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
