import webpush from "web-push";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { pushRepository } from "@/modules/push/push.repository";
import {
  type DeliveryOutcome,
  type DeliveryReport,
  MAX_FAILURES,
  PERMANENT_FAILURE_CODES,
  type PushPayload,
} from "@/modules/push/push.types";

// Web Push delivery.
//
// Three rules govern everything below, and they are the reason this file is not
// simply a loop around `webpush.sendNotification`:
//
//   1. THE SERVER DECIDES WHO. A caller passes user ids, never endpoints. A
//      client cannot address a device, its own or anyone else's.
//   2. PAYLOADS ARE MINIMAL. A push renders on a lock screen. Title, neutral
//      body, and a pointer — never the figure, the name or the decision.
//   3. DELIVERY NEVER BLOCKS BUSINESS. Every send is best-effort and swallows
//      its own errors, exactly like the existing email fan-outs. An approval
//      must not fail because a push service is down.

/** Configured once, lazily, so a missing key is a no-op rather than a crash. */
let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // `mailto:` or an https URL identifying the sender, per RFC 8292.
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    // Deliberately a warning, not a throw: push is progressive enhancement. An
    // environment without keys runs the whole intranet normally and simply
    // never sends a push.
    logger.warn(
      "Web Push disabled: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not all set",
    );
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** Test seam — lets a suite reset the memoised configuration. */
export function __resetPushConfigForTests() {
  configured = null;
}

/**
 * Only same-origin, root-relative paths may be delivered.
 *
 * The service worker opens whatever URL arrives, so this is the point where an
 * open redirect would be introduced. Mirrors `safeRedirectTarget()` in the web
 * app (Phase 4): absolute URLs and protocol-relative values are rejected
 * outright rather than sanitised.
 */
export function isSafeNotificationUrl(url: string): boolean {
  if (!url.startsWith("/")) return false;
  if (url.startsWith("//")) return false;
  // `/\evil.com` is treated as protocol-relative by some parsers.
  if (url.startsWith("/\\")) return false;
  return true;
}

export class PushService {
  /** Whether the deployment can send at all. Surfaced so the UI can hide opt-in. */
  isEnabled(): boolean {
    return ensureConfigured();
  }

  /** The key the browser needs to subscribe. Public by design. */
  getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  /**
   * Registers a device for the signed-in user.
   *
   * `userId` comes from the session, never from the body — a caller cannot
   * subscribe somebody else's account to their device, or vice versa.
   */
  async subscribe(
    userId: string,
    input: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string | null;
    },
  ) {
    if (!ensureConfigured()) {
      throw new BadRequestException(
        "Push notifications are not configured on this server",
      );
    }

    const subscription = await pushRepository.upsert({
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
    });

    // The endpoint is a capability URL — never log it, even truncated.
    logger.info("Push subscription registered", {
      userId,
      subscriptionId: subscription.id,
    });

    return { id: subscription.id };
  }

  async unsubscribe(userId: string, endpoint: string) {
    const { count } = await pushRepository.deleteForUser(userId, endpoint);
    if (count > 0) logger.info("Push subscription removed", { userId });
    return { removed: count > 0 };
  }

  /**
   * Drops every device for a user. Called on logout.
   *
   * Otherwise a shared or handed-on laptop keeps receiving the previous user's
   * notifications with no way for them to see or revoke it.
   */
  async unsubscribeAll(userId: string) {
    const { count } = await pushRepository.deleteAllForUser(userId);
    if (count > 0) {
      logger.info("Push subscriptions cleared on logout", { userId, count });
    }
    return { removed: count };
  }

  async countForUser(userId: string) {
    return pushRepository.countForUser(userId);
  }

  /**
   * Sends one payload to every device of the given recipients.
   *
   * Recipients are user ids resolved by the caller from its own authorisation
   * logic — this method does not decide who is entitled to anything, and it is
   * never reachable with a caller-supplied recipient list from the browser.
   */
  async sendToUsers(
    userIds: string[],
    payload: PushPayload,
  ): Promise<DeliveryReport> {
    const empty: DeliveryReport = {
      sent: 0,
      expired: 0,
      failed: 0,
      skipped: true,
    };

    if (!ensureConfigured()) return empty;
    if (userIds.length === 0) return empty;

    if (!isSafeNotificationUrl(payload.url)) {
      // Refuse rather than rewrite: a caller passing an absolute URL has a bug,
      // and quietly correcting it would hide that.
      logger.error("Refusing push with an unsafe target URL", {
        // The URL itself is safe to log — it is ours, not user content.
        url: payload.url,
      });
      return empty;
    }

    const unique = [...new Set(userIds)];
    const subscriptions = await pushRepository.findByUsers(unique);
    if (subscriptions.length === 0) return empty;

    const body = JSON.stringify(payload);

    const outcomes = await Promise.all(
      subscriptions.map((sub) => this.deliver(sub, body)),
    );

    const report: DeliveryReport = {
      sent: outcomes.filter((o) => o.status === "sent").length,
      expired: outcomes.filter((o) => o.status === "expired").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      skipped: false,
    };

    logger.info("Push fan-out complete", {
      recipients: unique.length,
      devices: subscriptions.length,
      ...report,
    });

    return report;
  }

  /** One device. Never throws — the caller's transaction is not ours to fail. */
  private async deliver(
    sub: {
      endpoint: string;
      p256dh: string;
      auth: string;
      failureCount: number;
    },
    body: string,
  ): Promise<DeliveryOutcome> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        { TTL: 60 * 60 * 24 },
      );
      await pushRepository.markSuccess(sub.endpoint);
      return { status: "sent", endpoint: sub.endpoint };
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : undefined;

      // Permanent: the push service says this endpoint is gone. Delete now
      // rather than counting towards a cap it will never recover from.
      if (
        statusCode !== undefined &&
        (PERMANENT_FAILURE_CODES as readonly number[]).includes(statusCode)
      ) {
        await pushRepository.deleteByEndpoint(sub.endpoint);
        logger.info("Pruned expired push subscription", { statusCode });
        return { status: "expired", endpoint: sub.endpoint, statusCode };
      }

      // Transient: keep the device, count the failure, and drop it once it has
      // clearly stopped working. "Transient" must not mean "forever".
      await pushRepository.incrementFailure(sub.endpoint);
      if (sub.failureCount + 1 >= MAX_FAILURES) {
        await pushRepository.deleteByEndpoint(sub.endpoint);
        logger.warn("Dropped push subscription after repeated failures", {
          failures: sub.failureCount + 1,
        });
      }

      logger.warn("Push delivery failed", { statusCode });
      return { status: "failed", endpoint: sub.endpoint, statusCode };
    }
  }
}

export const pushService = new PushService();
