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

async function readJsonBody(context: {
  req: { json: () => Promise<unknown> };
}): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
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

    if (method === "GET" && path === "/unread-count") {
      return context.json(await service.getUnreadSummary(userId));
    }

    if (method === "GET" && path === "/users") {
      return context.json(await service.listMessageableUsers(userId));
    }

    if (method === "POST" && path === "/dms") {
      const body = await readJsonBody(context);
      const userIds =
        typeof body === "object" &&
        body !== null &&
        Array.isArray((body as { userIds?: unknown }).userIds)
          ? (body as { userIds: unknown[] }).userIds.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
      const result = await service.createDirectMessage(userId, userIds);
      await broadcastChannelEvent({
        channelId: String(result.data.id),
        env: context.env,
        eventId: crypto.randomUUID(),
        payload: {
          type: "channel.created",
          channelId: result.data.id,
          payload: result.data,
        },
      });
      return context.json(result, 201);
    }

    if (method === "POST" && path === "/channels") {
      const body = await readJsonBody(context);
      const name =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { name?: unknown }).name === "string"
          ? (body as { name: string }).name
          : "";
      const isPrivate =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { isPrivate?: unknown }).isPrivate === "boolean"
          ? (body as { isPrivate: boolean }).isPrivate
          : false;
      const members =
        typeof body === "object" &&
        body !== null &&
        Array.isArray((body as { members?: unknown }).members)
          ? (body as { members: unknown[] }).members.filter(
              (value): value is string => typeof value === "string",
            )
          : undefined;
      const result = await service.createChannel(userId, {
        name,
        isPrivate,
        members,
      });
      await broadcastChannelEvent({
        channelId: String(result.data.id),
        env: context.env,
        eventId: crypto.randomUUID(),
        payload: {
          type: "channel.created",
          channelId: result.data.id,
          payload: result.data,
        },
      });
      return context.json(result, 201);
    }

    const channelMatch = /^\/channels\/([^/]+)$/u.exec(path);
    if (channelMatch?.[1]) {
      const channelId = channelMatch[1];
      if (method === "GET") {
        return context.json(await service.getChannel(channelId, userId));
      }
      if (method === "PUT") {
        const body = await readJsonBody(context);
        const name =
          typeof body === "object" &&
          body !== null &&
          typeof (body as { name?: unknown }).name === "string"
            ? (body as { name: string }).name
            : undefined;
        const result = await service.updateChannel(channelId, userId, { name });
        await broadcastChannelEvent({
          channelId,
          env: context.env,
          eventId: crypto.randomUUID(),
          payload: {
            type: "channel.updated",
            channelId,
            payload: result.data,
          },
        });
        return context.json(result);
      }
      if (method === "DELETE") {
        const result = await service.deleteChannel(channelId, userId);
        await broadcastChannelEvent({
          channelId,
          env: context.env,
          eventId: crypto.randomUUID(),
          payload: {
            type: "channel.deleted",
            channelId,
            payload: result.deletedChannel,
          },
        });
        return context.json({ data: result.data });
      }
    }

    const hideMatch = /^\/channels\/([^/]+)\/hide$/u.exec(path);
    if (method === "POST" && hideMatch?.[1]) {
      const channelId = hideMatch[1];
      const result = await service.hideConversation(channelId, userId);
      if (result.deletedChannel) {
        await broadcastChannelEvent({
          channelId,
          env: context.env,
          eventId: crypto.randomUUID(),
          payload: {
            type: "channel.deleted",
            channelId,
            payload: result.deletedChannel,
          },
        });
      }
      return context.json({ data: result.data });
    }

    const readMatch = /^\/channels\/([^/]+)\/read$/u.exec(path);
    if (method === "POST" && readMatch?.[1]) {
      const channelId = readMatch[1];
      const result = await service.markChannelRead(channelId, userId);
      await broadcastChannelEvent({
        channelId,
        env: context.env,
        eventId: crypto.randomUUID(),
        payload: {
          type: "channel.read",
          channelId,
          payload: {
            userId: result.userId,
            lastReadAt: result.lastReadAt,
          },
        },
      });
      return new Response(null, { status: 204 });
    }

    const typingMatch = /^\/channels\/([^/]+)\/typing$/u.exec(path);
    if (method === "POST" && typingMatch?.[1]) {
      const channelId = typingMatch[1];
      const typing = await service.signalTyping(channelId, userId);
      await broadcastChannelEvent({
        channelId,
        env: context.env,
        eventId: crypto.randomUUID(),
        payload: {
          type: "typing",
          channelId,
          payload: typing,
        },
      });
      return new Response(null, { status: 204 });
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
      // Clone before parse so attachment uploads can still proxy the raw body.
      const rawRequest = context.req.raw;
      let body: unknown;
      try {
        body = await rawRequest.clone().json();
      } catch {
        throw new HttpError(
          400,
          "INVALID_JSON",
          "Request body must be valid JSON.",
        );
      }
      const attachmentIds =
        typeof body === "object" &&
        body !== null &&
        Array.isArray((body as { attachmentIds?: unknown }).attachmentIds)
          ? (body as { attachmentIds: unknown[] }).attachmentIds
          : [];
      // Attachment linking still lives on Express/uploads until ported.
      if (attachmentIds.length > 0) {
        return proxyApiRequest(rawRequest, context.env);
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

    // Progressive: unknown/unsupported messages endpoints stay on Express.
    return proxyApiRequest(context.req.raw, context.env);
  });

  return app;
}
