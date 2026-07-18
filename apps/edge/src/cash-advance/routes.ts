import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, resolveHyperdriveRouteMode } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { resolveTrustedStorageOrigins } from "../trusted-storage";
import { createCashAdvanceService } from "./service";
import type { CashAdvanceStore } from "./store";

export type CreateCashAdvanceStore = (
  env: RuntimeBindings,
) => CashAdvanceStore | Promise<CashAdvanceStore>;

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

function itemHasReceipt(item: unknown): boolean {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as { receiptUrl?: unknown }).receiptUrl === "string" &&
    String((item as { receiptUrl: string }).receiptUrl).trim() !== ""
  );
}

function receiptsNeedProxy(
  env: RuntimeBindings,
  items: unknown[],
): boolean {
  const hasReceipt = items.some(itemHasReceipt);
  if (!hasReceipt) return false;

  const trustedOrigins = resolveTrustedStorageOrigins(env);
  if (trustedOrigins.length === 0) {
    // Express still owns SUPABASE_URL provenance until Worker origins are set.
    return true;
  }

  // Managed receipts can be validated on-edge; external CA receipts always fail
  // closed on Express too, so keep them edge-native for a consistent 400.
  return false;
}

function mapItems(rawItems: unknown[]) {
  return rawItems
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      description:
        typeof item.description === "string" ? item.description : "",
      requestedAmount: Number(item.requestedAmount),
      categoryId:
        item.categoryId === null
          ? null
          : typeof item.categoryId === "string"
            ? item.categoryId
            : undefined,
      receiptUrl:
        item.receiptUrl === null
          ? null
          : typeof item.receiptUrl === "string"
            ? item.receiptUrl
            : undefined,
    }));
}

export function createCashAdvanceRoutes(options: {
  createCashAdvanceStore?: CreateCashAdvanceStore;
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

    const store = await resolveStore(
      context.env,
      options.createCashAdvanceStore,
    );
    const trustedOrigins = resolveTrustedStorageOrigins(context.env);
    const service = createCashAdvanceService(store, { trustedOrigins });
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/cash-advance/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    // Self-scoped list. scope=all / approval / detail stay proxied unless update.
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
      if (receiptsNeedProxy(context.env, rawItems)) {
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
        items: mapItems(rawItems),
      });
      return context.json(result, 201);
    }

    const idMatch = /^\/([^/]+)\/?$/u.exec(path);
    if (method === "PUT" && idMatch) {
      const requestId = decodeURIComponent(idMatch[1] ?? "");
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
      if (receiptsNeedProxy(context.env, rawItems)) {
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
        await service.update(userId, requestId, {
          entityId:
            record.entityId === null
              ? null
              : typeof record.entityId === "string"
                ? record.entityId
                : undefined,
          payoutMode:
            typeof record.payoutMode === "string"
              ? record.payoutMode
              : undefined,
          bankName:
            record.bankName === null
              ? null
              : typeof record.bankName === "string"
                ? record.bankName
                : undefined,
          bankAccountNo:
            record.bankAccountNo === null
              ? null
              : typeof record.bankAccountNo === "string"
                ? record.bankAccountNo
                : undefined,
          currency:
            typeof record.currency === "string" ? record.currency : undefined,
          notes:
            record.notes === null
              ? null
              : typeof record.notes === "string"
                ? record.notes
                : undefined,
          items: Array.isArray(record.items) ? mapItems(rawItems) : undefined,
        }),
      );
    }

    const submitMatch = /^\/([^/]+)\/submit\/?$/u.exec(path);
    if (method === "POST" && submitMatch) {
      const requestId = decodeURIComponent(submitMatch[1] ?? "");
      return context.json(await service.submit(userId, requestId));
    }

    const approveMatch = /^\/([^/]+)\/approve\/?$/u.exec(path);
    if (method === "POST" && approveMatch) {
      const requestId = decodeURIComponent(approveMatch[1] ?? "");
      const body = await readJsonBody(context.req.raw);
      const record =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : {};
      const items = Array.isArray(record.items)
        ? record.items
            .filter(
              (item): item is Record<string, unknown> =>
                typeof item === "object" && item !== null,
            )
            .map((item) => ({
              id: typeof item.id === "string" ? item.id : "",
              approvedAmount: Number(item.approvedAmount),
            }))
            .filter((item) => item.id.length > 0)
        : undefined;
      return context.json(
        await service.approve(userId, requestId, {
          notes:
            typeof record.notes === "string" ? record.notes : undefined,
          items,
        }),
      );
    }

    const rejectMatch = /^\/([^/]+)\/reject\/?$/u.exec(path);
    if (method === "POST" && rejectMatch) {
      const requestId = decodeURIComponent(rejectMatch[1] ?? "");
      const body = await readJsonBody(context.req.raw);
      const reason =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { reason?: unknown }).reason === "string"
          ? (body as { reason: string }).reason
          : "";
      return context.json(await service.reject(userId, requestId, reason));
    }

    const disburseMatch = /^\/([^/]+)\/disburse\/?$/u.exec(path);
    if (method === "POST" && disburseMatch) {
      const requestId = decodeURIComponent(disburseMatch[1] ?? "");
      if (trustedOrigins.length === 0) {
        // Disbursement proof uses registered FileUpload provenance; without
        // TRUSTED_STORAGE_ORIGINS the Worker cannot validate managed URLs.
        return proxyApiRequest(context.req.raw, context.env);
      }
      const body = await readJsonBody(context.req.raw);
      const proofUrl =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { proofUrl?: unknown }).proofUrl === "string"
          ? (body as { proofUrl: string }).proofUrl
          : "";
      return context.json(await service.disburse(userId, requestId, proofUrl));
    }

    const clearMatch = /^\/([^/]+)\/clear\/?$/u.exec(path);
    if (method === "POST" && clearMatch) {
      const requestId = decodeURIComponent(clearMatch[1] ?? "");
      return context.json(await service.clear(userId, requestId));
    }

    // Signed receipt / disbursement-proof GET stay proxied: Express mints
    // Supabase JWT signed URLs. Worker R2 aws4fetch covers transfer intents
    // only, not FileUpload private-bucket receipt re-sign.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}

async function readJsonBody(rawRequest: Request): Promise<unknown> {
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
  if (bodyText.trim() === "") return {};
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }
}
