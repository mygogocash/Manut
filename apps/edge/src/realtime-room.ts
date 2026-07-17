import { DurableObject } from "cloudflare:workers";

import {
  admitRoomMessage,
  createRoomAttachment,
  parseRoomClientMessage,
  restoreRoomAttachment,
} from "./room-protocol";
import type { RuntimeBindings } from "./runtime";

function jsonMessage(value: unknown): string {
  return JSON.stringify(value);
}

export class RealtimeRoom extends DurableObject<RuntimeBindings> {
  async fetch(request: Request): Promise<Response> {
    if (
      request.method !== "GET" ||
      request.headers.get("upgrade")?.toLowerCase() !== "websocket"
    ) {
      return Response.json(
        {
          code: "WEBSOCKET_UPGRADE_REQUIRED",
          error: "WebSocket upgrade required.",
        },
        { status: 426 },
      );
    }

    const connectionId = request.headers.get("x-manut-connection-id") ?? "";
    const principalKey = request.headers.get("x-manut-principal-key") ?? "";
    let attachment;
    try {
      attachment = createRoomAttachment(connectionId, principalKey);
    } catch {
      return Response.json(
        { code: "INVALID_ROOM_TICKET", error: "Room connection was rejected." },
        { status: 403 },
      );
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [
      "member",
      `member:${principalKey.slice(0, 32)}`,
    ]);
    server.serializeAttachment(attachment);
    server.send(
      jsonMessage({
        connectedCount: this.ctx.getWebSockets("member").length,
        connectionId,
        type: "ready",
      }),
    );

    return new Response(null, {
      headers: {
        "cache-control": "no-store",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "x-content-type-options": "nosniff",
      },
      status: 101,
      webSocket: client,
    });
  }

  webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): void {
    const member = restoreRoomAttachment(socket);
    const message = parseRoomClientMessage(rawMessage);
    if (!member || !message) {
      socket.close(1008, "Invalid room message");
      return;
    }
    const admittedMember = admitRoomMessage(member);
    if (!admittedMember) {
      socket.close(1008, "Room message rate exceeded");
      return;
    }
    socket.serializeAttachment(admittedMember);

    if (message.type === "ping") {
      socket.send(jsonMessage({ id: message.id, type: "pong" }));
      return;
    }

    const outbound = jsonMessage({
      eventId: message.eventId,
      payload: message.payload,
      sender: admittedMember.connectionId,
      sentAt: Date.now(),
      type: "broadcast",
    });
    for (const peer of this.ctx.getWebSockets("member")) {
      if (!restoreRoomAttachment(peer)) continue;
      try {
        peer.send(outbound);
      } catch {
        peer.close(1011, "Delivery failed");
      }
    }
  }

  webSocketClose(
    _socket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {
    // Cloudflare completes the close handshake automatically on this compatibility date.
  }

  webSocketError(socket: WebSocket, _error: unknown): void {
    socket.close(1011, "Room connection failed");
  }
}
