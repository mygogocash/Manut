import { PostHog } from "posthog-node";

import { logger } from "@/common/utils/logger";

/**
 * Single chokepoint for product analytics in the Express API.
 *
 * All public methods are no-ops outside production unless TELEMETRY_ENABLED=1.
 * Init is lazy — first call constructs the client. The Node SDK batches
 * (flushAt: 20 / flushInterval: 10s); short-lived containers (cron, SIGTERM)
 * MUST `await tracking.shutdown()` before exiting or events will be lost.
 *
 * Runtime credentials must come from a verified Manut-owned environment.
 */

const isEnabled =
  process.env.NODE_ENV === "production" ||
  process.env.TELEMETRY_ENABLED === "1";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!isEnabled) return null;
  if (client) return client;

  const key = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST;
  if (!key || !host) {
    logger.warn(
      "[tracking] PostHog disabled — missing POSTHOG_API_KEY or POSTHOG_HOST",
    );
    return null;
  }

  client = new PostHog(key, {
    host,
    flushAt: 20,
    flushInterval: 10_000,
  });
  return client;
}

type Properties = Record<string, unknown>;

/**
 * Public methods accept `object` (not `Properties`) so per-event wrappers
 * can pass typed interfaces without each interface declaring a string
 * index signature.
 */
export const tracking = {
  identify(userId: string, traits: object): void {
    const c = getClient();
    if (!c) return;
    c.identify({ distinctId: userId, properties: traits as Properties });
  },

  groupIdentify(type: "entity", key: string, traits: object): void {
    const c = getClient();
    if (!c) return;
    c.groupIdentify({
      groupType: type,
      groupKey: key,
      properties: traits as Properties,
    });
  },

  /**
   * Server-side capture. `entityId` is required positionally so we never
   * accidentally land an event outside group analytics.
   */
  capture(
    userId: string,
    event: string,
    properties: object,
    entityId: string | null,
  ): void {
    const c = getClient();
    if (!c) return;
    c.capture({
      distinctId: userId,
      event,
      properties: properties as Properties,
      groups: entityId ? { entity: entityId } : undefined,
    });
  },

  async shutdown(): Promise<void> {
    if (!client) return;
    await client.shutdown();
    client = null;
  },
};
