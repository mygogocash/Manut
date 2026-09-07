import { createApp } from "./app";
import { PresenceRoom } from "./durable-objects/presence-room";
import { handleRealtimeUpgrade } from "./lib/realtime";
import { LeaveApprovalWorkflow } from "./workflows/leave-approval";
import type { Bindings } from "./env";

const app = createApp();

export { PresenceRoom, LeaveApprovalWorkflow };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/ws/")) {
      return handleRealtimeUpgrade(request, env);
    }
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Bindings>;

export type { Bindings };
