import { buildChannelRoomName } from "../room-protocol";
import type { RuntimeBindings } from "../runtime";

/**
 * Best-effort fan-out into the shared DO room after an edge-native write.
 * Missing REALTIME_ROOMS does not fail the HTTP mutation — Express bridge
 * remains available when the Worker write path is not used.
 */
export async function broadcastChannelEvent(options: {
  env: RuntimeBindings;
  channelId: string;
  eventId: string;
  payload: unknown;
}): Promise<void> {
  const rooms = options.env.REALTIME_ROOMS;
  if (!rooms) return;

  const room = rooms.getByName(buildChannelRoomName(options.channelId));
  try {
    await room.fetch(
      new Request("https://realtime.internal/broadcast", {
        body: JSON.stringify({
          eventId: options.eventId,
          payload: options.payload,
        }),
        headers: {
          "content-type": "application/json",
          "x-manut-internal-broadcast": "1",
        },
        method: "POST",
      }),
    );
  } catch {
    // Live fan-out is opportunistic; REST response remains authoritative.
  }
}
