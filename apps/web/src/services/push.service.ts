import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Web Push, API client.
//
// Thin on purpose. Everything that decides anything — who receives a
// notification, what it says, whether a device is still valid — lives on the
// server. This only carries the browser's subscription there and back.

export interface PushConfig {
  /** False when the deployment has no VAPID keys. The UI hides opt-in entirely. */
  enabled: boolean;
  /** The VAPID public key, base64url. Public by design. */
  publicKey: string | null;
  /** How many devices this user currently has registered. */
  deviceCount: number;
}

export async function getPushConfig(): Promise<ApiSuccessResponse<PushConfig>> {
  return api.get(`/push/config`);
}

export async function subscribeToPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.post(`/push/subscribe`, subscription);
}

export async function unsubscribeFromPush(
  endpoint: string,
): Promise<ApiSuccessResponse<{ removed: boolean }>> {
  return api.post(`/push/unsubscribe`, { endpoint });
}

/**
 * Drops every device for the signed-in user.
 *
 * Called on sign-out: a shared or handed-on laptop must not keep delivering the
 * previous person's notifications, and they have no way to revoke it once the
 * session is gone.
 */
export async function unsubscribeAllDevices(): Promise<
  ApiSuccessResponse<{ removed: number }>
> {
  return api.post(`/push/unsubscribe-all`, {});
}

/** Development-only; the route does not exist in production. */
export async function sendTestNotification(): Promise<
  ApiSuccessResponse<unknown>
> {
  return api.post(`/push/test`, {});
}
