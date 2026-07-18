import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { createLeaveService } from "./service";
import type { LeaveStore } from "./store";

export type CreateLeaveStore = (
  env: RuntimeBindings,
) => LeaveStore | Promise<LeaveStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateLeaveStore,
): Promise<LeaveStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveLeaveStore } = await import("./prisma-store");
  return createHyperdriveLeaveStore(env);
}

export function createLeaveRoutes(options: {
  createLeaveStore?: CreateLeaveStore;
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

    const store = await resolveStore(context.env, options.createLeaveStore);
    const service = createLeaveService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(/^\/api\/leave/u, "");
    const method = context.req.method.toUpperCase();

    // Self-scoped list. Team filters stay proxied.
    if (method === "GET" && (path === "/requests" || path === "/requests/")) {
      const employeeId = context.req.query("employeeId")?.trim();
      if (employeeId && employeeId !== userId) {
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

    // Self create only. HR on-behalf (other employeeId) stays proxied.
    if (method === "POST" && (path === "/requests" || path === "/requests/")) {
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
        throw new HttpError(400, "INVALID_LEAVE", "Request body is required.");
      }
      const record = body as Record<string, unknown>;
      const otherEmployeeId =
        typeof record.employeeId === "string" ? record.employeeId.trim() : "";
      if (otherEmployeeId && otherEmployeeId !== userId) {
        return proxyApiRequest(
          new Request(rawRequest.url, {
            body: bodyText,
            headers: rawRequest.headers,
            method: rawRequest.method,
          }),
          context.env,
        );
      }

      const durationType =
        record.durationType === "half_day" ? "half_day" : "full_day";
      const halfDayPeriod =
        record.halfDayPeriod === "am" || record.halfDayPeriod === "pm"
          ? record.halfDayPeriod
          : undefined;
      const source =
        record.source === "carried" || record.source === "entitled"
          ? record.source
          : undefined;

      const result = await service.create(userId, {
        leaveTypeId:
          typeof record.leaveTypeId === "string" ? record.leaveTypeId : "",
        startDate:
          typeof record.startDate === "string" ? record.startDate : "",
        endDate: typeof record.endDate === "string" ? record.endDate : "",
        durationType,
        halfDayPeriod,
        reason: typeof record.reason === "string" ? record.reason : undefined,
        source,
      });
      return context.json(result, 201);
    }

    const approveMatch = /^\/requests\/([^/]+)\/approve\/?$/u.exec(path);
    if (method === "PUT" && approveMatch) {
      const requestId = decodeURIComponent(approveMatch[1] ?? "");
      return context.json(await service.approve(userId, requestId));
    }

    const rejectMatch = /^\/requests\/([^/]+)\/reject\/?$/u.exec(path);
    if (method === "PUT" && rejectMatch) {
      const requestId = decodeURIComponent(rejectMatch[1] ?? "");
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
        body = bodyText.trim() === "" ? {} : (JSON.parse(bodyText) as unknown);
      } catch {
        throw new HttpError(
          400,
          "INVALID_JSON",
          "Request body must be valid JSON.",
        );
      }
      const reason =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { reason?: unknown }).reason === "string"
          ? (body as { reason: string }).reason
          : "";
      return context.json(await service.reject(userId, requestId, reason));
    }

    const cancelMatch = /^\/requests\/([^/]+)\/cancel\/?$/u.exec(path);
    if (method === "PUT" && cancelMatch) {
      const requestId = decodeURIComponent(cancelMatch[1] ?? "");
      return context.json(await service.cancel(userId, requestId));
    }

    // approve-cancellation / reject-cancellation / types / balances stay proxied.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
