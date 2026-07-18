import { z } from "zod";

/**
 * Edge Durable Object room helpers.
 *
 * Expo live chat currently uses the Express messageBus via socket.io
 * `/messages` (see `buildMessagesSocketNamespaceUrl`). Remaining DO gaps:
 * - Edge scopes rooms as `${principalKey}:${roomId}` so two users joining the
 *   same channel id never share a DO instance.
 * - RealtimeRoom only echoes client `broadcast` payloads; it is not wired to
 *   the Express messageBus.
 * Next step: membership-keyed shared DO room + bus→DO broadcast, then retire
 * the socket.io interim path.
 */

const SAFE_ROOM_ID = /^[A-Za-z0-9_-]{1,96}$/u;

export function isRealtimeRoomId(value: string): boolean {
  return SAFE_ROOM_ID.test(value);
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

/** Remaining DO work after the socket.io interim live path. */
export const REALTIME_DO_CHAT_GAP =
  "Edge RealtimeRoom is still principal-scoped (${principalKey}:${roomId}) and not bridged to Express messageBus; Expo live chat uses API socket.io /messages as the interim shared channel until a membership-keyed DO room + bus→DO broadcast lands.";

/** @deprecated Prefer REALTIME_DO_CHAT_GAP; kept for import stability. */
export const REALTIME_LIVE_CHAT_BLOCKER = REALTIME_DO_CHAT_GAP;
