import { Hono } from "hono";

import {
  enforceRefreshOrigin,
  enforceSameOrigin,
  extractCredential,
  isPublicApiRoute,
  principalKey,
  type VerifyAccessToken,
  verifyAccessToken,
} from "./auth";
import { sha256Base64Url } from "./crypto";
import { HttpError } from "./http-error";
import {
  BackgroundWorkflow,
  ContainerBoundary,
  handleScheduled,
  platformCapabilities,
  requireContainer,
  requireHyperdrive,
} from "./platform-boundaries";
import { consumeQueue, QueueLedger } from "./queue";
import { RealtimeRoom } from "./realtime-room";
import { isRoomId } from "./room-protocol";
import type { EdgeEnv, RuntimeBindings } from "./runtime";
import { uploadRoutes } from "./uploads";

export { BackgroundWorkflow, ContainerBoundary, QueueLedger, RealtimeRoom };

const NO_BODY_METHODS = new Set(["GET", "HEAD"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

interface EdgeAppOptions {
  verifyToken?: VerifyAccessToken;
}

function configuredApiOrigin(value: string): URL {
  try {
    const origin = new URL(value.trim());
    const safeProtocol =
      origin.protocol === "https:" ||
      (origin.protocol === "http:" && LOOPBACK_HOSTS.has(origin.hostname));
    if (
      !safeProtocol ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    ) {
      throw new Error("Unsafe API origin.");
    }
    return origin;
  } catch {
    throw new HttpError(
      503,
      "API_ORIGIN_NOT_CONFIGURED",
      "The API origin is unavailable.",
    );
  }
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

async function proxyApiRequest(
  request: Request,
  env: RuntimeBindings,
): Promise<Response> {
  const origin = configuredApiOrigin(env.API_ORIGIN);
  const incoming = new URL(request.url);
  const basePath = origin.pathname.replace(/\/+$/u, "");
  const target = new URL(origin);
  target.pathname = `${basePath}${incoming.pathname}`;
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.delete("x-manut-connection-id");
  headers.delete("x-manut-principal-key");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");

  const upstreamRequest = new Request(target.toString(), {
    body: NO_BODY_METHODS.has(request.method) ? undefined : request.body,
    headers,
    method: request.method,
    redirect: "manual",
  });
  try {
    return await fetch(upstreamRequest);
  } catch {
    throw new HttpError(
      502,
      "API_UPSTREAM_UNAVAILABLE",
      "The API is temporarily unavailable.",
    );
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

    // Until the authoritative API exposes a shared-room membership contract,
    // scope rooms to the verified principal. This prevents a guessed room name
    // from becoming cross-user authorization.
    const principalScope = context.get("principalKey");
    const room = context.env.REALTIME_ROOMS.getByName(
      `${principalScope}:${roomId}`,
    );
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
    throw new HttpError(
      501,
      "HYPERDRIVE_CONTRACT_NOT_IMPLEMENTED",
      "Database contract is disabled.",
    );
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
