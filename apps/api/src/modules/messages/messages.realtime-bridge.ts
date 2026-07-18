import { createHmac, timingSafeEqual } from "node:crypto";

import { logger } from "@/common/utils/logger";
import {
  messageBus,
  type MessageBusEvent,
} from "@/modules/messages/messages.bus";

const BRIDGE_HEADER = "x-manut-realtime-bridge";
const SAFE_CHANNEL_ID = /^[A-Za-z0-9_-]{1,96}$/u;

export interface RealtimeBridgeOptions {
  origin?: string | null;
  secret?: string | null;
  fetchImpl?: typeof fetch;
}

function configuredOrigin(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function configuredSecret(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length >= 32 ? trimmed : null;
}

function shouldFanOut(event: MessageBusEvent): boolean {
  return event.type === "message.created" || event.type === "message.deleted";
}

function eventIdFor(event: MessageBusEvent): string {
  const seed = `${event.type}:${event.channelId}:${JSON.stringify(event.payload)}`;
  return createHmac("sha256", "manut-realtime-event-id")
    .update(seed)
    .digest("base64url")
    .slice(0, 32);
}

/**
 * Fan out messageBus create/delete events to the edge Durable Object shared
 * room (`channel:{channelId}`). Inactive when origin/secret are unset so
 * socket.io remains the live path until the Worker is provisioned.
 */
export function registerMessagesRealtimeBridge(
  options: RealtimeBridgeOptions = {},
): () => void {
  const origin =
    options.origin !== undefined
      ? configuredOrigin(options.origin)
      : configuredOrigin(process.env.EDGE_REALTIME_ORIGIN);
  const secret =
    options.secret !== undefined
      ? configuredSecret(options.secret)
      : configuredSecret(process.env.EDGE_REALTIME_BRIDGE_SECRET);
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!origin || !secret) {
    logger.info(
      "Messages realtime DO bridge inactive (EDGE_REALTIME_ORIGIN / EDGE_REALTIME_BRIDGE_SECRET unset)",
    );
    return () => {};
  }

  const unsubscribe = messageBus.subscribeAll((event) => {
    if (!shouldFanOut(event)) return;
    if (!SAFE_CHANNEL_ID.test(event.channelId)) {
      logger.warn("Skipping DO bridge fan-out for unsafe channel id", {
        channelId: event.channelId,
        eventType: event.type,
      });
      return;
    }

    void (async () => {
      const url = `${origin}/api/v1/realtime/rooms/${encodeURIComponent(event.channelId)}/events`;
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [BRIDGE_HEADER]: secret,
          },
          body: JSON.stringify({
            eventId: eventIdFor(event),
            payload: event,
          }),
        });
        if (!response.ok) {
          logger.warn("DO bridge fan-out rejected", {
            channelId: event.channelId,
            eventType: event.type,
            status: response.status,
          });
        }
      } catch (error) {
        logger.warn("DO bridge fan-out failed", {
          channelId: event.channelId,
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });

  logger.info("Messages realtime DO bridge registered", { origin });
  return unsubscribe;
}

/** Test helper: constant-time compare for bridge secrets (unused in prod path). */
export function realtimeBridgeSecretsEqual(
  left: string,
  right: string,
): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
