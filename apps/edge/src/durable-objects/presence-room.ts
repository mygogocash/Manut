import { DurableObject } from "cloudflare:workers";
import type { Bindings } from "../env";
import { applyPresenceEvent, parsePresenceEvent, type PresenceOccupant } from "./presence-protocol";

/**
 * Hibernatable WebSocket room per message channel.
 * Importers: worker entry export + `/ws/messages/:channelId` + messages typing.
 */
export class PresenceRoom extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? "anonymous";
    const userName = url.searchParams.get("userName") ?? "Anonymous";
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    if (!client || !server) return new Response("WebSocket pair failed", { status: 500 });
    this.ctx.acceptWebSocket(server, [userId, userName]);
    const occupants = this.currentOccupants();
    const next = applyPresenceEvent(occupants, { type: "join", userId, userName });
    this.broadcast(JSON.stringify({ type: "presence", occupants: next }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    const event = parsePresenceEvent(message);
    if (!event) return;
    if (event.type === "join" || event.type === "leave") {
      const occupants = applyPresenceEvent(this.currentOccupants(), event);
      this.broadcast(JSON.stringify({ type: "presence", occupants }));
      return;
    }
    this.broadcast(message, ws);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const tags = this.ctx.getTags(ws);
    const userId = tags[0];
    if (userId) {
      const occupants = applyPresenceEvent(this.currentOccupants(), { type: "leave", userId });
      this.broadcast(JSON.stringify({ type: "presence", occupants }));
    }
    ws.close(code, reason);
  }

  /** RPC from the HTTP API (typing indicators). */
  async broadcast(message: string, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) {
      if (except && socket === except) continue;
      socket.send(message);
    }
  }

  private currentOccupants(): PresenceOccupant[] {
    const seen = new Map<string, PresenceOccupant>();
    for (const socket of this.ctx.getWebSockets()) {
      const [userId, userName] = this.ctx.getTags(socket);
      if (userId) seen.set(userId, { userId, userName: userName ?? userId });
    }
    return [...seen.values()];
  }
}
