import { isRecord } from "./http-error";

export const MAX_ROOM_MESSAGE_BYTES = 8 * 1024;
export const MAX_ROOM_MESSAGES_PER_MINUTE = 120;
const ROOM_MESSAGE_WINDOW_MS = 60 * 1000;

export interface RoomAttachment {
  connectionId: string;
  joinedAt: number;
  messageCount: number;
  principalKey: string;
  version: 1;
  windowStartedAt: number;
}

export type RoomClientMessage =
  | { id: string | null; type: "ping" }
  | { eventId: string; payload: unknown; type: "broadcast" };

const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]{1,96}$/u;

export function isRoomId(value: string): boolean {
  return SAFE_IDENTIFIER.test(value);
}

/** Shared membership-keyed Durable Object name for a messaging channel. */
export function buildChannelRoomName(channelId: string): string {
  if (!isRoomId(channelId)) {
    throw new Error("Invalid channel room id.");
  }
  return `channel:${channelId}`;
}

export function createRoomAttachment(
  connectionId: string,
  principalKey: string,
  joinedAt = Date.now(),
): RoomAttachment {
  if (
    !SAFE_IDENTIFIER.test(connectionId) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(principalKey)
  ) {
    throw new Error("Invalid room attachment.");
  }
  return {
    connectionId,
    joinedAt,
    messageCount: 0,
    principalKey,
    version: 1,
    windowStartedAt: joinedAt,
  };
}

export function parseRoomAttachment(value: unknown): RoomAttachment | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.connectionId !== "string" ||
    !SAFE_IDENTIFIER.test(value.connectionId) ||
    typeof value.principalKey !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(value.principalKey) ||
    typeof value.joinedAt !== "number" ||
    !Number.isSafeInteger(value.joinedAt) ||
    typeof value.messageCount !== "number" ||
    !Number.isSafeInteger(value.messageCount) ||
    value.messageCount < 0 ||
    value.messageCount > MAX_ROOM_MESSAGES_PER_MINUTE ||
    typeof value.windowStartedAt !== "number" ||
    !Number.isSafeInteger(value.windowStartedAt)
  ) {
    return null;
  }
  return {
    connectionId: value.connectionId,
    joinedAt: value.joinedAt,
    messageCount: value.messageCount,
    principalKey: value.principalKey,
    version: 1,
    windowStartedAt: value.windowStartedAt,
  };
}

export function admitRoomMessage(
  attachment: RoomAttachment,
  now = Date.now(),
): RoomAttachment | null {
  if (!Number.isSafeInteger(now)) {
    return null;
  }
  const windowExpired =
    now < attachment.windowStartedAt ||
    now - attachment.windowStartedAt >= ROOM_MESSAGE_WINDOW_MS;
  const messageCount = windowExpired ? 0 : attachment.messageCount;
  if (messageCount >= MAX_ROOM_MESSAGES_PER_MINUTE) {
    return null;
  }
  return {
    ...attachment,
    messageCount: messageCount + 1,
    windowStartedAt: windowExpired ? now : attachment.windowStartedAt,
  };
}

export function restoreRoomAttachment(
  socket: WebSocket,
): RoomAttachment | null {
  return parseRoomAttachment(socket.deserializeAttachment());
}

export function parseRoomClientMessage(
  message: string | ArrayBuffer,
): RoomClientMessage | null {
  const text =
    typeof message === "string"
      ? message
      : new TextDecoder().decode(new Uint8Array(message));
  if (new TextEncoder().encode(text).byteLength > MAX_ROOM_MESSAGE_BYTES) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "ping") {
    return {
      id:
        typeof value.id === "string" && value.id.length <= 96 ? value.id : null,
      type: "ping",
    };
  }
  if (
    value.type === "broadcast" &&
    typeof value.eventId === "string" &&
    SAFE_IDENTIFIER.test(value.eventId) &&
    value.payload !== undefined
  ) {
    return {
      eventId: value.eventId,
      payload: value.payload,
      type: "broadcast",
    };
  }
  return null;
}
