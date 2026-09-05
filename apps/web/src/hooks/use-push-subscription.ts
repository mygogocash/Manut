"use client";

import * as React from "react";

import {
  getPushConfig,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/services/push.service";

// Web Push opt-in, from the browser's side.
//
// The rule that shapes this file: THE PROMPT IS NEVER AUTOMATIC. Browsers
// permanently block a site that asks on page load and gets dismissed, so the
// permission request only ever happens inside `enable()`, which only ever runs
// from a click. There is no effect here that calls `requestPermission`.
//
// Everything is feature-detected. A browser without service workers, without
// PushManager, or without Notification — Firefox in a private window, an older
// Safari, an insecure origin — reports `supported: false` and the rest of the
// intranet is untouched.

export type PushStatus =
  /** Still working out what the browser and server can do. */
  | "checking"
  /** This browser cannot do Web Push at all. */
  | "unsupported"
  /** The server has no VAPID keys configured. */
  | "unconfigured"
  /** Supported and available, not yet enabled on this device. */
  | "idle"
  /** Enabled on this device. */
  | "subscribed"
  /** The user said no. Only they can undo this, in browser settings. */
  | "denied"
  | "working"
  | "error";

export interface PushSubscriptionState {
  status: PushStatus;
  /** Devices registered for this user, across all their browsers. */
  deviceCount: number;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/**
 * VAPID keys travel as base64url; `applicationServerKey` wants bytes.
 *
 * The return type is pinned to `Uint8Array<ArrayBuffer>` rather than the bare
 * `Uint8Array`: since TypeScript 5.7 the type is generic over its backing
 * buffer, and a `SharedArrayBuffer`-backed array is not a valid `BufferSource`.
 * Allocating the buffer explicitly is what makes that concrete.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** `PushSubscription.toJSON()` is loosely typed; narrow it once, here. */
function readKeys(
  sub: PushSubscription,
): { p256dh: string; auth: string } | null {
  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) return null;
  return { p256dh, auth };
}

export function usePushSubscription(): PushSubscriptionState {
  const [status, setStatus] = React.useState<PushStatus>("checking");
  const [deviceCount, setDeviceCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const publicKeyRef = React.useRef<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Reads state only. Nothing here can raise a permission prompt.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!supported) {
        setStatus("unsupported");
        return;
      }

      try {
        const { data } = await getPushConfig();
        if (cancelled) return;

        setDeviceCount(data.deviceCount);
        if (!data.enabled || !data.publicKey) {
          setStatus("unconfigured");
          return;
        }
        publicKeyRef.current = data.publicKey;

        if (Notification.permission === "denied") {
          setStatus("denied");
          return;
        }

        const registration = await navigator.serviceWorker.getRegistration();
        const existing = await registration?.pushManager.getSubscription();
        if (cancelled) return;

        setStatus(existing ? "subscribed" : "idle");
      } catch {
        if (!cancelled) {
          // A failed config read should not present as "denied" — the user has
          // not refused anything.
          setStatus("error");
          setError("Could not check notification settings.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = React.useCallback(async () => {
    if (!supported || !publicKeyRef.current) return;
    setError(null);
    setStatus("working");

    try {
      // Called from a click, which is the only place this belongs.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return;
      }

      // `ready` rather than `getRegistration`: the worker may still be
      // activating on a first visit, and subscribing before then throws.
      const registration = await navigator.serviceWorker.ready;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          // Required by Chrome: a subscription that cannot show a notification
          // is not allowed, and silent push would be the alternative.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKeyRef.current),
        }));

      const keys = readKeys(subscription);
      if (!keys) {
        setStatus("error");
        setError("This browser returned an unusable subscription.");
        return;
      }

      await subscribeToPush({ endpoint: subscription.endpoint, keys });
      setDeviceCount((n) => n + 1);
      setStatus("subscribed");
    } catch {
      setStatus("error");
      setError("Could not enable notifications on this device.");
    }
  }, [supported]);

  const disable = React.useCallback(async () => {
    if (!supported) return;
    setError(null);
    setStatus("working");

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        // Tell the server first: if the browser-side unsubscribe succeeds and
        // the API call then fails, the server keeps sending to an endpoint the
        // browser has already thrown away.
        await unsubscribeFromPush(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }

      setDeviceCount((n) => Math.max(0, n - 1));
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Could not turn notifications off on this device.");
    }
  }, [supported]);

  return { status, deviceCount, error, enable, disable };
}
