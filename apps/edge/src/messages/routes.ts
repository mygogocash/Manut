import { Hono } from "hono";

import { proxyApiRequest } from "../api-proxy";
import { HttpError } from "../http-error";
import { hyperdriveConnectionString, isHyperdriveEnabled } from "../hyperdrive";
import type { EdgeEnv, RuntimeBindings } from "../runtime";
import { broadcastChannelEvent } from "./broadcast";
import { createMessagesService } from "./service";
import type { MessagesStore } from "./store";

export type CreateMessagesStore = (
  env: RuntimeBindings,
) => MessagesStore | Promise<MessagesStore>;

function hyperdriveBoundaryRequested(env: RuntimeBindings): boolean {
  return env.ENABLE_HYPERDRIVE_BOUNDARY === "true";
}

async function resolveStore(
  env: RuntimeBindings,
  createStore?: CreateMessagesStore,
): Promise<MessagesStore> {
  if (createStore) {
    return createStore(env);
  }
  // Touch the connection string so empty Hyperdrive bindings fail closed.
  hyperdriveConnectionString(env);
  const { createHyperdriveMessagesStore } = await import("./prisma-store");
  return createHyperdriveMessagesStore(env);
}

export function createMessagesRoutes(options: {
  createMessagesStore?: CreateMessagesStore;
} = {}): Hono<EdgeEnv> {
  const app = new Hono<EdgeEnv>();

  app.all("/*", async (context) => {
    // Dual-path: Hyperdrive boundary on → Worker/Prisma; off → Express.
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

    const store = await resolveStore(context.env, options.createMessagesStore);
    const service = createMessagesService(store);
    const userId = context.get("principal").subject;
    const path = new URL(context.req.url).pathname.replace(
      /^\/api\/messages/u,
      "",
    );
    const method = context.req.method.toUpperCase();

    if (method === "GET" && path === "/channels") {
      return context.json(await service.listChannels(userId));
    }

    const channelMatch = /^\/channels\/([^/]+)$/u.exec(path);
    if (method === "GET" && channelMatch?.[1]) {
      return context.json(await service.getChannel(channelMatch[1], userId));
    }

    const listMessagesMatch = /^\/channels\/([^/]+)\/messages$/u.exec(path);
    if (method === "GET" && listMessagesMatch?.[1]) {
      const page = Math.max(1, Number(context.req.query("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(context.req.query("limit")) || 50),
      );
      return context.json(
        await service.listMessages(listMessagesMatch[1], userId, page, limit),
      );
    }

    if (method === "POST" && listMessagesMatch?.[1]) {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        throw new HttpError(
          400,
          "INVALID_JSON",
          "Request body must be valid JSON.",
        );
      }
      const content =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { content?: unknown }).content === "string"
          ? (body as { content: string }).content
          : "";
      const result = await service.sendMessage(
        listMessagesMatch[1],
        userId,
        content,
      );
      await broadcastChannelEvent({
        channelId: listMessagesMatch[1],
        env: context.env,
        eventId: crypto.randomUUID(),
        payload: {
          type: "message.created",
          channelId: listMessagesMatch[1],
          payload: result.data,
        },
      });
      return context.json(result, 201);
    }

    const deleteMatch =
      /^\/channels\/([^/]+)\/messages\/([^/]+)$/u.exec(path);
    if (method === "DELETE" && deleteMatch?.[1] && deleteMatch[2]) {
      const result = await service.deleteMessage(
        deleteMatch[1],
        deleteMatch[2],
        userId,
      );
      await broadcastChannelEvent({
        channelId: deleteMatch[1],
        env: context.env,
        eventId: crypto.randomUUID(),
        payload: {
          type: "message.deleted",
          channelId: deleteMatch[1],
          payload: result.data,
        },
      });
      return context.json(result);
    }

    // Progressive: remaining messages endpoints stay on Express until ported.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
