import type { Server as HttpServer } from "node:http";

import { parseCookie } from "cookie";
import {
  type Namespace,
  type RemoteSocket,
  Server,
  type Socket,
} from "socket.io";

import { PERMISSIONS } from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import {
  type AuthUser,
  getBearerToken,
  loadUserPermissions,
  resolveAuthUserFromToken,
} from "@/core/guards/auth.guard";
import { isAuthenticationEligible } from "@/core/guards/auth-eligibility";
import {
  assertCanAccessChannel,
  type MessageAccessChannel,
  shouldBroadcastChannelToUser,
} from "@/modules/messages/messages.access";
import {
  messageBus,
  type MessageBusEvent,
} from "@/modules/messages/messages.bus";
import { messagesRepository } from "@/modules/messages/messages.repository";
import { messagesService } from "@/modules/messages/messages.service";

const SOCKET_PATH = "/socket.io/";
const NAMESPACE = "/messages";
const READ_ROOM = PERMISSIONS.MESSAGES_READ;
const ADMIN_ROOM = PERMISSIONS.MESSAGES_ADMIN;

interface MessagesSocketData {
  user: AuthUser;
}

interface ClientToServerEvents {
  "channel:join": (
    payload: { channelId?: string },
    ack?: (res: unknown) => void,
  ) => void;
  "channel:leave": (payload: { channelId?: string }) => void;
  "message:send": (
    payload: { channelId?: string; content?: string; attachmentIds?: string[] },
    ack?: (res: unknown) => void,
  ) => void;
  "message:delete": (
    payload: { channelId?: string; messageId?: string },
    ack?: (res: unknown) => void,
  ) => void;
  typing: (
    payload: { channelId?: string },
    ack?: (res: unknown) => void,
  ) => void;
}

interface ServerToClientEvents {
  "messages:event": (event: MessageBusEvent) => void;
}

type MessagesSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  MessagesSocketData
>;

type MessagesNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  MessagesSocketData
>;

type ManagedMessagesSocket =
  MessagesSocket | RemoteSocket<ServerToClientEvents, MessagesSocketData>;

export interface MessagesSocketOptions {
  resolveUserFromToken?: typeof resolveAuthUserFromToken;
  loadPermissionsForUser?: typeof loadUserPermissions;
}

// Socket.io has its own CORS handler — separate from the Express
// allowlist set in `app.ts`. The two used different env vars, so a
// prod deploy that only set `CORS_ALLOWED_ORIGINS` / `PORTAL_URL`
// (which is what `deploy.yml` actually wires up) left the socket
// transport with an empty list → every browser handshake from the
// canonical web origin failed CORS preflight, surfacing in the
// console as a stream of `socket.io/?EIO=4&transport=poll…`
// errors. This now reads the same chain the Express middleware
// uses, plus a hardcoded production fallback so a missing env var
// never breaks the realtime channel.
const PROD_FALLBACK_ORIGIN = "https://intranet.manut.example";

function allowedOrigins() {
  const raw =
    process.env.CORS_ALLOWED_ORIGINS ??
    process.env.ALLOWED_ORIGINS ??
    process.env.PORTAL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length > 0) return origins;
  if (process.env.NODE_ENV === "production") return [PROD_FALLBACK_ORIGIN];
  return [];
}

function channelRoom(channelId: string) {
  return `channel:${channelId}`;
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function tokenFromSocket(socket: Socket) {
  const authToken =
    socket.handshake.auth &&
    typeof socket.handshake.auth === "object" &&
    "token" in socket.handshake.auth &&
    typeof socket.handshake.auth.token === "string"
      ? socket.handshake.auth.token
      : null;
  if (authToken) return authToken;

  const bearer = getBearerToken(
    firstHeader(socket.handshake.headers.authorization),
  );
  if (bearer) return bearer;

  const cookies = parseCookie(
    firstHeader(socket.handshake.headers.cookie) ?? "",
  );
  return cookies.manut_access_token;
}

function isRawChannelPayload(
  payload: unknown,
): payload is MessageAccessChannel {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !Array.isArray(candidate.members)) {
    return false;
  }
  const firstMember = (candidate.members as unknown[])[0];
  return (
    candidate.members.length === 0 ||
    (typeof firstMember === "object" &&
      firstMember !== null &&
      "userId" in firstMember)
  );
}

async function channelForEvent(event: MessageBusEvent) {
  if (
    (event.type === "channel.created" ||
      event.type === "channel.updated" ||
      event.type === "channel.deleted") &&
    isRawChannelPayload(event.payload)
  ) {
    return event.payload;
  }

  return messagesRepository.findChannelById(event.channelId);
}

async function disconnectUnauthorizedSocket(socket: ManagedMessagesSocket) {
  await Promise.all(
    Array.from(socket.rooms)
      .filter((room) => room !== socket.id)
      .map((room) => socket.leave(room)),
  );
  socket.disconnect(true);
}

async function revalidateSocketAuthorization(
  socket: ManagedMessagesSocket,
  options: Required<MessagesSocketOptions>,
  requiredPermission?: string,
) {
  let profile: Awaited<
    ReturnType<typeof messagesRepository.findUserAuthorizationById>
  >;
  let permissions: Set<string>;

  try {
    profile = await messagesRepository.findUserAuthorizationById(
      socket.data.user.id,
    );
    if (!profile || !isAuthenticationEligible(profile)) {
      await disconnectUnauthorizedSocket(socket);
      throw new Error("Unauthorized");
    }
    permissions = await options.loadPermissionsForUser(profile.id);
  } catch (err) {
    await disconnectUnauthorizedSocket(socket);
    throw err instanceof Error ? err : new Error("Unauthorized");
  }

  const user: AuthUser = {
    ...profile,
    permissions: Array.from(permissions),
  };
  socket.data.user = user;

  if (!permissions.has(PERMISSIONS.MESSAGES_READ)) {
    await disconnectUnauthorizedSocket(socket);
    throw new Error("Permission denied");
  }

  await socket.join(userRoom(user.id));
  await socket.join(READ_ROOM);
  if (permissions.has(PERMISSIONS.MESSAGES_ADMIN)) {
    await socket.join(ADMIN_ROOM);
  } else {
    await socket.leave(ADMIN_ROOM);
  }

  if (requiredPermission && !permissions.has(requiredPermission)) {
    throw new Error("Permission denied");
  }

  return user;
}

async function emitMessageEvent(
  nsp: MessagesNamespace,
  event: MessageBusEvent,
  options: Required<MessagesSocketOptions>,
) {
  const channel = await channelForEvent(event);
  if (!channel) return;

  const sockets = await nsp.fetchSockets();
  await Promise.all(
    sockets.map(async (socket) => {
      try {
        const user = await revalidateSocketAuthorization(socket, options);
        const canAccess = shouldBroadcastChannelToUser(user, channel);
        if (!canAccess) {
          await socket.leave(channelRoom(event.channelId));
          return;
        }

        if (
          event.type === "typing" &&
          !socket.rooms.has(channelRoom(event.channelId))
        ) {
          return;
        }

        socket.emit("messages:event", event);
      } catch {
        // Revalidation is fail-closed and disconnects sockets whose lifecycle
        // or baseline read access can no longer be confirmed.
      }
    }),
  );
}

function socketAuthMiddleware(options: Required<MessagesSocketOptions>) {
  return async (socket: MessagesSocket, next: (err?: Error) => void) => {
    try {
      const user = await options.resolveUserFromToken(tokenFromSocket(socket));
      if (!isAuthenticationEligible(user)) {
        next(new Error("Account deactivated"));
        return;
      }

      const permissions = await options.loadPermissionsForUser(user.id);
      user.permissions = Array.from(permissions);
      if (!user.permissions.includes(PERMISSIONS.MESSAGES_READ)) {
        next(new Error("Permission denied"));
        return;
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  };
}

function registerConnectionHandlers(
  socket: MessagesSocket,
  options: Required<MessagesSocketOptions>,
) {
  const connectedUserId = socket.data.user.id;
  socket.join(userRoom(connectedUserId));
  socket.join(READ_ROOM);
  if (socket.data.user.permissions.includes(PERMISSIONS.MESSAGES_ADMIN)) {
    socket.join(ADMIN_ROOM);
  }

  socket.on("channel:join", async (payload, ack?: (res: unknown) => void) => {
    try {
      const user = await revalidateSocketAuthorization(socket, options);
      const channelId =
        payload &&
        typeof payload === "object" &&
        "channelId" in payload &&
        typeof payload.channelId === "string"
          ? payload.channelId
          : null;
      if (!channelId) {
        ack?.({ ok: false, error: "channelId is required" });
        return;
      }

      const channel = await messagesRepository.findChannelById(channelId);
      if (!channel) {
        ack?.({ ok: false, error: "Channel not found" });
        return;
      }

      assertCanAccessChannel(user, channel);
      socket.join(channelRoom(channelId));
      ack?.({ ok: true });
    } catch (err) {
      ack?.({
        ok: false,
        error: err instanceof Error ? err.message : "Unable to join channel",
      });
    }
  });

  socket.on("channel:leave", (payload) => {
    const channelId =
      payload &&
      typeof payload === "object" &&
      "channelId" in payload &&
      typeof payload.channelId === "string"
        ? payload.channelId
        : null;
    if (channelId) socket.leave(channelRoom(channelId));
  });

  socket.on("message:send", async (payload, ack) => {
    try {
      const user = await revalidateSocketAuthorization(
        socket,
        options,
        PERMISSIONS.MESSAGES_CREATE,
      );
      const channelId =
        payload &&
        typeof payload === "object" &&
        "channelId" in payload &&
        typeof payload.channelId === "string"
          ? payload.channelId
          : null;
      const content =
        payload &&
        typeof payload === "object" &&
        "content" in payload &&
        typeof payload.content === "string"
          ? payload.content
          : "";
      const attachmentIds =
        payload &&
        typeof payload === "object" &&
        "attachmentIds" in payload &&
        Array.isArray(payload.attachmentIds)
          ? (payload.attachmentIds as string[])
          : [];

      if (!channelId) {
        ack?.({ ok: false, error: "channelId is required" });
        return;
      }

      if (!content.trim() && attachmentIds.length === 0) {
        ack?.({ ok: false, error: "Message content or attachments required" });
        return;
      }

      const message = await messagesService.sendMessage(
        channelId,
        user.id,
        { content: content.trim(), attachmentIds },
        user,
      );

      ack?.({ ok: true, data: message });
    } catch (err) {
      ack?.({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to send message",
      });
    }
  });

  socket.on("message:delete", async (payload, ack) => {
    try {
      const user = await revalidateSocketAuthorization(
        socket,
        options,
        PERMISSIONS.MESSAGES_DELETE,
      );
      const channelId =
        payload &&
        typeof payload === "object" &&
        "channelId" in payload &&
        typeof payload.channelId === "string"
          ? payload.channelId
          : null;
      const messageId =
        payload &&
        typeof payload === "object" &&
        "messageId" in payload &&
        typeof payload.messageId === "string"
          ? payload.messageId
          : null;

      if (!channelId || !messageId) {
        ack?.({ ok: false, error: "channelId and messageId are required" });
        return;
      }

      await messagesService.deleteMessage(messageId, user, channelId);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to delete message",
      });
    }
  });

  socket.on("typing", async (payload, ack) => {
    try {
      const user = await revalidateSocketAuthorization(
        socket,
        options,
        PERMISSIONS.MESSAGES_CREATE,
      );
      const channelId =
        payload &&
        typeof payload === "object" &&
        "channelId" in payload &&
        typeof payload.channelId === "string"
          ? payload.channelId
          : null;

      if (!channelId) {
        ack?.({ ok: false, error: "channelId is required" });
        return;
      }

      await messagesService.signalTyping(channelId, {
        userId: user.id,
        userName: user.name,
        permissions: user.permissions,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to signal typing",
      });
    }
  });

  socket.on("disconnect", (reason) => {
    logger.debug("Messages socket disconnected", {
      userId: connectedUserId,
      reason,
    });
  });
}

export function registerMessagesSocket(
  server: HttpServer,
  options: MessagesSocketOptions = {},
) {
  const origins = allowedOrigins();
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    MessagesSocketData
  >(server, {
    path: SOCKET_PATH,
    // This compatibility bridge uses WebSocket-only transport so a
    // horizontally scaled container never splits polling and upgrade
    // requests. New realtime traffic is handled by the edge Durable Object.
    transports: ["websocket"],
    cors: {
      origin(origin, callback) {
        if (!origin || origins.length === 0 || origins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed"));
      },
      credentials: true,
    },
  });
  const nsp = io.of(NAMESPACE);
  const resolvedOptions: Required<MessagesSocketOptions> = {
    resolveUserFromToken:
      options.resolveUserFromToken ?? resolveAuthUserFromToken,
    loadPermissionsForUser:
      options.loadPermissionsForUser ?? loadUserPermissions,
  };

  nsp.use(socketAuthMiddleware(resolvedOptions));
  nsp.on("connection", (socket) => {
    registerConnectionHandlers(socket, resolvedOptions);
  });

  const unsubscribe = messageBus.subscribeAll((event) => {
    void emitMessageEvent(nsp, event, resolvedOptions).catch((err) => {
      logger.warn("Failed to emit messages socket event", {
        eventType: event.type,
        channelId: event.channelId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  const originalClose = io.close.bind(io);
  io.close = ((callback?: (err?: Error) => void) => {
    unsubscribe();
    return originalClose(callback);
  }) as Server["close"];

  return io;
}
