// Web Push types and delivery policy.
//
// The policy constants live here rather than being buried in the service so
// they are reviewable in one place — how many failures a device tolerates, and
// which push-service responses mean "gone" rather than "try later".

/** What the browser hands us from `PushManager.subscribe()`. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * A notification, as it goes over the wire.
 *
 * Deliberately small. A push payload renders on a lock screen, so it carries a
 * neutral title, a neutral body and a pointer — never the figure, the name or
 * the decision. The application fetches the detail after the user opens it.
 */
export interface PushPayload {
  title: string;
  body: string;
  /** Same-origin, root-relative path. Validated before it is ever sent. */
  url: string;
  /**
   * The originating notification's id, reused rather than minted here so the
   * service worker can collapse duplicates and the client can mark it read.
   */
  notificationId?: string;
  /** Groups replaceable notifications on the device. */
  tag?: string;
}

/** Where a delivery attempt ended up. */
export type DeliveryOutcome =
  | { status: "sent"; endpoint: string }
  | { status: "expired"; endpoint: string; statusCode: number }
  | { status: "failed"; endpoint: string; statusCode?: number };

export interface DeliveryReport {
  sent: number;
  expired: number;
  failed: number;
  /** No subscriptions at all — distinct from "tried and failed". */
  skipped: boolean;
}

/**
 * Push-service responses that mean the endpoint is permanently gone.
 *
 * 404 — the push service has never heard of it.
 * 410 — it existed and has been revoked (the browser was reinstalled, the user
 *       cleared site data, the subscription rotated).
 *
 * Both delete the row immediately. Anything else is treated as transient, so a
 * push service having a bad afternoon does not cost users their subscriptions.
 */
export const PERMANENT_FAILURE_CODES = [404, 410] as const;

/**
 * Consecutive transient failures before a subscription is dropped.
 *
 * Ten is arbitrary but bounded — the point is that "transient" cannot mean
 * "forever". A device that has failed ten sends in a row is not coming back.
 */
export const MAX_FAILURES = 10;

/** Truncation for the stored user-agent. Enough to recognise a device. */
export const USER_AGENT_MAX = 255;
