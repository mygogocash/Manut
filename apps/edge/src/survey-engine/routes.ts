import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, resolveHyperdriveRouteMode } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { createSurveyEngineService, type SurveyEngineConfig } from "./service";
import type { SurveyKind, SurveyStore } from "./store";

export type { SurveyKind };

export type CreateSurveyStore = (
  env: RuntimeBindings,
) => SurveyStore | Promise<SurveyStore>;

async function resolveStore(
  env: RuntimeBindings,
  kind: SurveyKind,
  createStore?: CreateSurveyStore,
): Promise<SurveyStore> {
  if (createStore) {
    return createStore(env);
  }
  hyperdriveConnectionString(env);
  const { createHyperdriveSurveyStore } = await import("./prisma-store");
  return createHyperdriveSurveyStore(env, kind);
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type OwnedPath =
  | { kind: "detail"; id: string }
  | { kind: "questions"; id: string }
  | { kind: "publish"; id: string }
  | { kind: "announce"; id: string }
  | { kind: "schedule"; id: string }
  | { kind: "close"; id: string }
  | { kind: "reopen"; id: string }
  | { kind: "archive"; id: string }
  | { kind: "unarchive"; id: string }
  | { kind: "responses"; id: string }
  | { kind: "my-response"; id: string }
  | { kind: "analytics"; id: string };

function matchOwnedPath(path: string): OwnedPath | null {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1 && UUID_RE.test(segments[0]!)) {
    return { kind: "detail", id: segments[0]! };
  }
  if (segments.length !== 2 || !UUID_RE.test(segments[0]!)) {
    return null;
  }
  const id = segments[0]!;
  const action = segments[1]!;
  switch (action) {
    case "questions":
      return { kind: "questions", id };
    case "publish":
      return { kind: "publish", id };
    case "announce":
      return { kind: "announce", id };
    case "schedule":
      return { kind: "schedule", id };
    case "close":
      return { kind: "close", id };
    case "reopen":
      return { kind: "reopen", id };
    case "archive":
      return { kind: "archive", id };
    case "unarchive":
      return { kind: "unarchive", id };
    case "responses":
      return { kind: "responses", id };
    case "my-response":
      return { kind: "my-response", id };
    case "analytics":
      return { kind: "analytics", id };
    default:
      return null;
  }
}

function announcePayloadPresent(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "announce" in body &&
    (body as { announce: unknown }).announce != null
  );
}

export function createSurveyEngineRoutes(options: {
  kind: SurveyKind;
  apiPrefix: "/api/survey" | "/api/survey-forms";
  config: SurveyEngineConfig;
  createSurveyStore?: CreateSurveyStore;
}): Hono<EdgeEnv> {
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
      options.kind,
      options.createSurveyStore,
    );
    const service = createSurveyEngineService(store, options.config);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(
      new RegExp(`^${options.apiPrefix}`),
      "",
    );
    const method = context.req.method.toUpperCase();

    if (method === "GET" && (path === "" || path === "/")) {
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 20),
      );
      const status = context.req.query("status")?.trim() || undefined;
      const scopeRaw = context.req.query("scope")?.trim() || "available";
      const scope =
        scopeRaw === "mine" || scopeRaw === "all" || scopeRaw === "available"
          ? scopeRaw
          : "available";
      const archived = context.req.query("archived") === "true";
      return context.json(
        await service.list(userId, { page, limit, status, scope, archived }),
      );
    }

    if (method === "POST" && (path === "" || path === "/")) {
      const body = await readJsonBody(context);
      if (typeof body !== "object" || body === null) {
        throw new HttpError(400, "INVALID_SURVEY", "Request body is required.");
      }
      const record = body as Record<string, unknown>;
      const result = await service.create(userId, {
        title: typeof record.title === "string" ? record.title : "",
        description:
          typeof record.description === "string" ? record.description : null,
        isAnonymous: record.isAnonymous === true,
      });
      return context.json(result, 201);
    }

    if (
      method === "GET" &&
      (path === "/announcement-settings" || path === "/announcement-settings/")
    ) {
      return context.json(await service.getAnnouncementDefaults(userId));
    }
    if (
      method === "PUT" &&
      (path === "/announcement-settings" || path === "/announcement-settings/")
    ) {
      const body = await readJsonBody(context);
      return context.json(await service.setAnnouncementDefaults(userId, body));
    }
    if (
      method === "GET" &&
      (path === "/notification-settings" || path === "/notification-settings/")
    ) {
      return context.json(await service.getNotificationRecipients(userId));
    }
    if (
      method === "PUT" &&
      (path === "/notification-settings" || path === "/notification-settings/")
    ) {
      const body = await readJsonBody(context);
      return context.json(await service.setNotificationRecipients(userId, body));
    }

    const matched = matchOwnedPath(path);
    if (matched?.kind === "detail" && method === "GET") {
      return context.json(await service.getById(userId, matched.id));
    }
    if (matched?.kind === "questions" && method === "PUT") {
      const body = await readJsonBody(context);
      return context.json(
        await service.replaceQuestions(userId, matched.id, body),
      );
    }
    if (matched?.kind === "publish" && method === "POST") {
      // Announce-on-publish is not safe on edge: wall/news/companyDate writes
      // live in Express modules. Proxy when an announce block is present.
      const raw = context.req.raw;
      const peek = raw.clone();
      let body: unknown = {};
      try {
        body = await peek.json();
      } catch {
        body = {};
      }
      if (announcePayloadPresent(body)) {
        return proxyApiRequest(raw, context.env);
      }
      return context.json(await service.publish(userId, matched.id));
    }
    if (matched?.kind === "announce" && method === "POST") {
      // Wall / news / company-date side-effects stay on Express.
      return proxyApiRequest(context.req.raw, context.env);
    }
    if (matched?.kind === "schedule" && method === "PUT") {
      const body = await readJsonBody(context);
      return context.json(await service.setSchedule(userId, matched.id, body));
    }
    if (matched?.kind === "close" && method === "POST") {
      return context.json(await service.close(userId, matched.id));
    }
    if (matched?.kind === "reopen" && method === "POST") {
      return context.json(await service.reopen(userId, matched.id));
    }
    if (matched?.kind === "archive" && method === "POST") {
      return context.json(await service.archive(userId, matched.id));
    }
    if (matched?.kind === "unarchive" && method === "POST") {
      return context.json(await service.unarchive(userId, matched.id));
    }
    if (matched?.kind === "responses" && method === "POST") {
      const body = await readJsonBody(context);
      const result = await service.submitResponse(userId, matched.id, body);
      return context.json(result, 201);
    }
    if (matched?.kind === "responses" && method === "GET") {
      return context.json(await service.listResponses(userId, matched.id));
    }
    if (matched?.kind === "my-response" && method === "GET") {
      return context.json(await service.getMyResponse(userId, matched.id));
    }
    if (matched?.kind === "analytics" && method === "GET") {
      return context.json(await service.getAnalytics(userId, matched.id));
    }

    // Leftovers that still need Express: PUT/DELETE form metadata, announce
    // side-effects (handled above), and any future exotic surfaces.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
