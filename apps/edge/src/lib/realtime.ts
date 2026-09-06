import type { Bindings } from "../env";

const CHANNEL = /^\/ws\/messages\/([^/]+)$/;

/** DO stub plus the RPC method PresenceRoom exports. */
type PresenceRoomStub = DurableObjectStub & { broadcast(message: string): Promise<void> };

export function presenceStub(env: Bindings, channelId: string): PresenceRoomStub | null {
  if (!env.PRESENCE) return null;
  return env.PRESENCE.get(env.PRESENCE.idFromName(channelId)) as PresenceRoomStub;
}

export async function handleRealtimeUpgrade(request: Request, env: Bindings): Promise<Response> {
  const url = new URL(request.url);
  const match = CHANNEL.exec(url.pathname);
  const channelId = match?.[1];
  if (!channelId) return new Response("Not found", { status: 404 });
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  const stub = presenceStub(env, channelId);
  if (!stub) return new Response("Presence unavailable", { status: 503 });
  return stub.fetch(request);
}

export async function broadcastChannelEvent(
  env: Bindings,
  channelId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const stub = presenceStub(env, channelId);
  if (!stub) return false;
  await stub.broadcast(JSON.stringify(payload));
  return true;
}
