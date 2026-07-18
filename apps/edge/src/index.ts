import { Hono } from "hono";

import { proxyApiRequest } from "./api-proxy";
import {
  enforceRefreshOrigin,
  enforceSameOrigin,
  extractCredential,
  isPublicApiRoute,
  principalKey,
  type VerifyAccessToken,
  verifyAccessToken,
} from "./auth";
import { createBenefitsRoutes } from "./benefits/routes";
import {
  createCashAdvanceRoutes,
  type CreateCashAdvanceStore,
} from "./cash-advance/routes";
import { assertChannelMembership } from "./channel-membership";
import { sha256Base64Url } from "./crypto";
import {
  createDealsRoutes,
  type CreateDealsStore,
} from "./deals/routes";
import {
  createExpensesRoutes,
  type CreateExpensesStore,
} from "./expenses/routes";
import { HttpError } from "./http-error";
import { isHyperdriveEnabled } from "./hyperdrive";
import { createLearningRoutes } from "./learning/routes";
import {
  createLeaveRoutes,
  type CreateLeaveStore,
} from "./leave/routes";
import {
  createMessagesRoutes,
  type CreateMessagesStore,
} from "./messages/routes";
import {
  createPayrollRoutes,
  type CreatePayrollStore,
} from "./payroll/routes";
import {
  BackgroundWorkflow,
  ContainerBoundary,
  handleScheduled,
  platformCapabilities,
  requireContainer,
  requireHyperdrive,
} from "./platform-boundaries";
import { consumeQueue, QueueLedger } from "./queue";
import {
  assertRealtimeBridgeSecret,
  bridgeSigningKey,
} from "./realtime-bridge-auth";
import { RealtimeRoom } from "./realtime-room";
import { buildChannelRoomName, isRoomId } from "./room-protocol";
import type { EdgeEnv, RuntimeBindings } from "./runtime";
import { createSurveyRoutes, type CreateSurveyStore } from "./survey/routes";
import {
  createSurveyFormsRoutes,
  type CreateSurveyFormsStore,
} from "./survey-forms/routes";
import { uploadRoutes } from "./uploads";
import { createVisaRoutes, type CreateVisaStore } from "./visa/routes";
import { createVisaChecklistRoutes } from "./visa-checklist/routes";
import { createVisaKbRoutes } from "./visa-kb/routes";

export { BackgroundWorkflow, ContainerBoundary, QueueLedger, RealtimeRoom };

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

interface EdgeAppOptions {
  createCashAdvanceStore?: CreateCashAdvanceStore;
  createDealsStore?: CreateDealsStore;
  createExpensesStore?: CreateExpensesStore;
  createLeaveStore?: CreateLeaveStore;
  createMessagesStore?: CreateMessagesStore;
  createPayrollStore?: CreatePayrollStore;
  createSurveyStore?: CreateSurveyStore;
  createSurveyFormsStore?: CreateSurveyFormsStore;
  createVisaStore?: CreateVisaStore;
  verifyToken?: VerifyAccessToken;
}

function requestIdFor(request: Request): string {
  const ray = request.headers.get("cf-ray")?.trim() ?? "";
  return SAFE_REQUEST_ID.test(ray) ? ray : crypto.randomUUID();
}

async function enforceRateLimit(context: {
  env: RuntimeBindings;
  req: { header(name: string): string | undefined; path: string };
}): Promise<void> {
  const clientAddress =
    context.req.header("cf-connecting-ip")?.trim() || "unknown";
  const segments = context.req.path.split("/").filter(Boolean);
  const bucket =
    segments[1] === "v1" ? segments.slice(0, 3) : segments.slice(0, 2);
  const key = await sha256Base64Url(
    `api:${clientAddress}:/${bucket.join("/")}`,
  );
  let outcome: RateLimitOutcome;
  try {
    outcome = await context.env.API_RATE_LIMITER.limit({ key });
  } catch {
    throw new HttpError(
      503,
      "RATE_LIMITER_UNAVAILABLE",
      "Request admission is unavailable.",
    );
  }
  if (!outcome.success) {
    throw new HttpError(429, "RATE_LIMITED", "Too many requests.");
  }
}

export function createEdgeApp(options: EdgeAppOptions = {}): Hono<EdgeEnv> {
  const app = new Hono<EdgeEnv>();
  const verifyToken = options.verifyToken ?? verifyAccessToken;

  app.use("*", async (context, next) => {
    context.set("requestId", requestIdFor(context.req.raw));
    await next();

    // A 101 response carries a live WebSocket handle. Cloning it to append
    // headers would detach that handle, so the room endpoint hardens its own
    // handshake response and this middleware leaves it intact.
    if (context.res.status === 101 || context.res.webSocket) return;

    if (
      !context.res.headers
        .get("cache-control")
        ?.toLowerCase()
        .includes("no-store")
    ) {
      context.header("Cache-Control", "no-store");
    }
    context.header(
      "Content-Security-Policy",
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    context.header("Cross-Origin-Opener-Policy", "same-origin");
    context.header("Cross-Origin-Resource-Policy", "same-origin");
    context.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    context.header("Referrer-Policy", "no-referrer");
    context.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    context.header("X-Content-Type-Options", "nosniff");
    context.header("X-Frame-Options", "DENY");
    context.header("X-Request-Id", context.get("requestId"));
    context.res.headers.delete("server");
    context.res.headers.delete("x-powered-by");
  });

  app.use("/api/*", async (context, next) => {
    await enforceRateLimit(context);

    const request = context.req.raw;
    const pathname = new URL(request.url).pathname;
    const publicRoute = isPublicApiRoute(request.method, pathname);
    if (!publicRoute) {
      const credential = extractCredential(request.headers);
      if (!credential) {
        throw new HttpError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication is required.",
        );
      }
      enforceSameOrigin(request, credential);
      const principal = await verifyToken(credential.token, context.env);
      context.set("credential", credential);
      context.set("principal", principal);
      context.set("principalKey", await principalKey(principal));
    } else if (request.method === "POST" && pathname === "/api/auth/refresh") {
      enforceRefreshOrigin(request);
    }

    await next();
  });

  app.get("/health", (context) =>
    context.json({
      service: "manut-intranet-edge",
      status: "ok",
    }),
  );

  app.route("/api/v1/uploads", uploadRoutes);
  app.route(
    "/api/messages",
    createMessagesRoutes({
      createMessagesStore: options.createMessagesStore,
    }),
  );
  app.route(
    "/api/deals",
    createDealsRoutes({
      createDealsStore: options.createDealsStore,
    }),
  );
  app.route(
    "/api/survey",
    createSurveyRoutes({
      createSurveyStore: options.createSurveyStore,
    }),
  );
  app.route(
    "/api/survey-forms",
    createSurveyFormsRoutes({
      createSurveyStore: options.createSurveyFormsStore,
    }),
  );
  app.route(
    "/api/expenses",
    createExpensesRoutes({
      createExpensesStore: options.createExpensesStore,
    }),
  );
  app.route(
    "/api/leave",
    createLeaveRoutes({
      createLeaveStore: options.createLeaveStore,
    }),
  );
  app.route(
    "/api/cash-advance",
    createCashAdvanceRoutes({
      createCashAdvanceStore: options.createCashAdvanceStore,
    }),
  );
  app.route(
    "/api/visa",
    createVisaRoutes({
      createVisaStore: options.createVisaStore,
    }),
  );
  app.route("/api/visa-kb", createVisaKbRoutes());
  app.route("/api/visa-checklist", createVisaChecklistRoutes());
  app.route(
    "/api/payroll",
    createPayrollRoutes({
      createPayrollStore: options.createPayrollStore,
    }),
  );
  app.route("/api/benefits", createBenefitsRoutes());
  app.route("/api/learning", createLearningRoutes());

  app.post("/api/v1/realtime/rooms/:roomId/events", async (context) => {
    const roomId = context.req.param("roomId");
    if (!isRoomId(roomId)) {
      throw new HttpError(404, "ROOM_NOT_FOUND", "Room not found.");
    }
    assertRealtimeBridgeSecret(context.req.raw, context.env);
    // Touch the signing key so a missing binding fails closed before fan-out.
    bridgeSigningKey(context.env);
    const rooms = context.env.REALTIME_ROOMS;
    if (!rooms) {
      throw new HttpError(
        503,
        "REALTIME_ROOMS_NOT_PROVISIONED",
        "Realtime rooms are unavailable.",
      );
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { eventId?: unknown }).eventId !== "string" ||
      (body as { payload?: unknown }).payload === undefined
    ) {
      throw new HttpError(
        400,
        "INVALID_BROADCAST",
        "Broadcast payload is invalid.",
      );
    }

    const room = rooms.getByName(buildChannelRoomName(roomId));
    return room.fetch(
      new Request("https://realtime.internal/broadcast", {
        body: JSON.stringify({
          eventId: (body as { eventId: string }).eventId,
          payload: (body as { payload: unknown }).payload,
        }),
        headers: {
          "content-type": "application/json",
          "x-manut-internal-broadcast": "1",
        },
        method: "POST",
      }),
    );
  });

  app.get("/api/v1/realtime/rooms/:roomId", async (context) => {
    const roomId = context.req.param("roomId");
    if (!isRoomId(roomId)) {
      throw new HttpError(404, "ROOM_NOT_FOUND", "Room not found.");
    }
    if (context.req.header("upgrade")?.toLowerCase() !== "websocket") {
      return context.json(
        {
          code: "WEBSOCKET_UPGRADE_REQUIRED",
          error: {
            code: "WEBSOCKET_UPGRADE_REQUIRED",
            message: "WebSocket upgrade required.",
          },
        },
        426,
      );
    }

    const credential = context.get("credential");
    // Membership before binding so access denial is never masked by provisioning.
    await assertChannelMembership({
      channelId: roomId,
      credential,
      env: context.env,
      userId: context.get("principal").subject,
    });

    const rooms = context.env.REALTIME_ROOMS;
    if (!rooms) {
      throw new HttpError(
        503,
        "REALTIME_ROOMS_NOT_PROVISIONED",
        "Realtime rooms are unavailable.",
      );
    }

    // Shared membership-keyed room so all authorized peers share one DO.
    const principalScope = context.get("principalKey");
    const room = rooms.getByName(buildChannelRoomName(roomId));
    const headers = new Headers({
      upgrade: "websocket",
      "x-manut-connection-id": crypto.randomUUID(),
      "x-manut-principal-key": principalScope,
    });
    return room.fetch(
      new Request(context.req.url, {
        headers,
        method: "GET",
      }),
    );
  });

  app.get("/api/v1/platform/capabilities", (context) =>
    context.json(platformCapabilities(context.env)),
  );

  app.post("/api/v1/platform/workflows", () => {
    throw new HttpError(
      503,
      "WORKFLOW_AUTHORIZATION_NOT_PROVISIONED",
      "Workflow authorization is not provisioned.",
    );
  });

  app.post("/api/v1/platform/containers/:operation", (context) => {
    requireContainer(context.env);
    throw new HttpError(
      501,
      "CONTAINER_CONTRACT_NOT_IMPLEMENTED",
      "Container contract is disabled.",
    );
  });

  app.get("/api/v1/platform/hyperdrive", (context) => {
    requireHyperdrive(context.env);
    return context.json({
      binding: "HYPERDRIVE_DATABASE",
      enabled: isHyperdriveEnabled(context.env),
      ready: true,
      source: "hyperdrive",
    });
  });

  app.all("/api/*", (context) => proxyApiRequest(context.req.raw, context.env));

  app.notFound((context) =>
    context.json(
      {
        code: "NOT_FOUND",
        error: { code: "NOT_FOUND", message: "Route not found." },
      },
      404,
    ),
  );

  app.onError((error, context) => {
    if (error instanceof HttpError) {
      if (error.status === 429) context.header("Retry-After", "60");
      return context.json(
        {
          code: error.code,
          error: { code: error.code, message: error.message },
        },
        error.status,
      );
    }
    console.error(
      JSON.stringify({
        code: "UNHANDLED_EDGE_ERROR",
        requestId: context.get("requestId") || "unknown",
      }),
    );
    return context.json(
      {
        code: "INTERNAL_ERROR",
        error: {
          code: "INTERNAL_ERROR",
          message: "The edge service could not process the request.",
        },
      },
      500,
    );
  });

  return app;
}

export const app = createEdgeApp();

export default {
  fetch(request, env, executionContext) {
    return app.fetch(request, env, executionContext);
  },
  queue(batch, env) {
    return consumeQueue(batch, env);
  },
  scheduled(controller, env) {
    return handleScheduled(controller, env);
  },
} satisfies ExportedHandler<RuntimeBindings, unknown>;
