import { z } from "zod";

/**
 * Edge Durable Object room helpers for shared messaging channels.
 *
 * Room URL path uses the channel id; the Worker maps it to Durable Object
 * name `channel:{channelId}` after an API membership check. Express
 * messageBus fans `message.created` / `message.deleted` into that DO when
 * `EDGE_REALTIME_ORIGIN` + `EDGE_REALTIME_BRIDGE_SECRET` are configured.
 * Expo prefers the DO WebSocket and keeps socket.io as fallback.
 */

const SAFE_ROOM_ID = /^[A-Za-z0-9_-]{1,96}$/u;

export function isRealtimeRoomId(value: string): boolean {
  return SAFE_ROOM_ID.test(value);
}

/** Shared membership-keyed Durable Object name (Worker-side getByName). */
export function buildRealtimeChannelRoomName(channelId: string): string {
  if (!isRealtimeRoomId(channelId)) {
    throw new Error("Invalid realtime channel id.");
  }
  return `channel:${channelId}`;
}

export function buildRealtimeRoomPath(roomId: string): string {
  if (!isRealtimeRoomId(roomId)) {
    throw new Error("Invalid realtime room id.");
  }
  return `/api/v1/realtime/rooms/${roomId}`;
}

export function buildRealtimeRoomWebSocketUrl(
  originOrBase: string,
  roomId: string,
): string {
  const path = buildRealtimeRoomPath(roomId);
  const trimmed = originOrBase.replace(/\/+$/, "");
  if (trimmed.startsWith("/")) {
    throw new Error(
      "Realtime WebSocket URL requires an absolute origin (edge host).",
    );
  }
  const absolute = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const wsOrigin = absolute.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  return `${wsOrigin}${path}`;
}

const realtimeServerMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ready"),
      connectionId: z.string().min(1),
      connectedCount: z.number().int().nonnegative().optional(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("pong"),
      id: z.string().nullable().optional(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("broadcast"),
      eventId: z.string().min(1),
      payload: z.unknown(),
      sender: z.string().min(1).optional(),
      sentAt: z.number().optional(),
    })
    .passthrough(),
]);

export type RealtimeServerMessage = z.infer<typeof realtimeServerMessageSchema>;

export function parseRealtimeServerMessage(
  raw: string,
): RealtimeServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const parsed = realtimeServerMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Operational note (not a hard blocker): DO shared rooms + bus bridge are
 * implemented; socket.io remains the client fallback when the edge origin or
 * bridge secret is unset in a given environment.
 */
export const REALTIME_DO_CHAT_GAP =
  "Live chat prefers edge Durable Object shared rooms (channel:{channelId}) with membership check + messageBus→DO bridge; socket.io /messages remains the fallback when EDGE_REALTIME_ORIGIN / EXPO_PUBLIC_REALTIME_ORIGIN is unset.";

/** @deprecated Prefer REALTIME_DO_CHAT_GAP; kept for import stability. */
export const REALTIME_LIVE_CHAT_BLOCKER = REALTIME_DO_CHAT_GAP;
