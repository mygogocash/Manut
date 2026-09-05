import { Router } from "express";

import { authenticate, requireActive } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { pushService } from "@/modules/push/push.service";
import {
  parseSubscribeInput,
  parseUnsubscribeInput,
  testNotificationSchema,
} from "@/modules/push/push.validation";

// Web Push subscription API.
//
// ── Why there is no permission code ──
//
// Every route here acts on the CALLER'S OWN devices. Managing your own
// notification delivery is not a privilege the organisation grants — anyone who
// can sign in can turn notifications on for their own phone. Ownership is the
// authorisation, taken from `req.user.id` and never from the request body, so
// there is nothing a permission gate would add beyond `authenticate`.
//
// What is deliberately absent: any route that sends to another user. Recipients
// are resolved server-side inside the modules that raise events; a browser can
// never address somebody else's device.

const router = Router();

router.use(authenticate, requireActive);

/**
 * What the client needs to decide whether to offer the opt-in.
 *
 * The VAPID public key is public by design — it is what the browser passes to
 * `PushManager.subscribe()`. The private key never leaves the server.
 */
router.get(
  "/config",
  asyncHandler(async (req, res) => {
    const enabled = pushService.isEnabled();
    res.json({
      data: {
        enabled,
        publicKey: enabled ? pushService.getPublicKey() : null,
        // Lets the UI say "on 2 devices" without a second request.
        deviceCount: await pushService.countForUser(req.user!.id),
      },
    });
  }),
);

/** Registers this browser. Idempotent — re-subscribing updates the row. */
router.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const input = parseSubscribeInput(req.body);
    const data = await pushService.subscribe(req.user!.id, {
      endpoint: input.endpoint,
      keys: input.keys,
      // Prefer the real header over the client's claim about itself.
      userAgent: req.get("user-agent") ?? input.userAgent ?? null,
    });
    res.status(201).json({ data });
  }),
);

/**
 * Removes this browser.
 *
 * Scoped to the caller in the repository, so posting somebody else's endpoint
 * deletes nothing rather than unsubscribing them.
 */
router.post(
  "/unsubscribe",
  asyncHandler(async (req, res) => {
    const input = parseUnsubscribeInput(req.body);
    const data = await pushService.unsubscribe(req.user!.id, input.endpoint);
    res.json({ data });
  }),
);

/**
 * Removes every device for the caller. Used by the client on sign-out.
 *
 * A shared laptop that keeps delivering the previous user's notifications is
 * the failure this prevents.
 */
router.post(
  "/unsubscribe-all",
  asyncHandler(async (req, res) => {
    const data = await pushService.unsubscribeAll(req.user!.id);
    res.json({ data });
  }),
);

/**
 * Sends a test notification to the CALLER'S own devices.
 *
 * Two safety properties, both deliberate:
 *
 *   1. It takes no recipient. The only person it can notify is whoever is
 *      holding the session, so it cannot be used to push text at colleagues.
 *   2. It is not registered at all in production. `NODE_ENV === "production"`
 *      is checked here rather than inside the handler, so the route does not
 *      exist on the live intranet — a 404, not a guarded 403. Fail-closed: any
 *      environment that does not explicitly say it is production gets the
 *      route, which is the safe direction for a self-only test trigger.
 */
if (process.env.NODE_ENV !== "production") {
  router.post(
    "/test",
    asyncHandler(async (req, res) => {
      const input = testNotificationSchema.parse(req.body);
      const data = await pushService.sendToUsers([req.user!.id], {
        title: input.title ?? "Test notification",
        body: input.body ?? "Push is working on this device.",
        url: "/dashboard",
        tag: "push-test",
      });
      res.json({ data });
    }),
  );
}

export default router;
