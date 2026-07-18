import { DurableObject } from "cloudflare:workers";

import { HttpError, isRecord, readBoundedJson } from "./http-error";
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

function fanOutBroadcast(
  sockets: WebSocket[],
  outbound: string,
): void {
  for (const peer of sockets) {
    if (!restoreRoomAttachment(peer)) continue;
    try {
      peer.send(outbound);
    } catch {
      peer.close(1011, "Delivery failed");
    }
  }
}

export class RealtimeRoom extends DurableObject<RuntimeBindings> {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST") {
      return this.handleServerBroadcast(request);
    }

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

  private async handleServerBroadcast(request: Request): Promise<Response> {
    if (request.headers.get("x-manut-internal-broadcast") !== "1") {
      return Response.json(
        {
          code: "REALTIME_BROADCAST_FORBIDDEN",
          error: "Internal broadcast required.",
        },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await readBoundedJson(request, 32 * 1024);
    } catch (error) {
      if (error instanceof HttpError) {
        return Response.json(
          { code: error.code, error: error.message },
          { status: error.status },
        );
      }
      return Response.json(
        { code: "INVALID_JSON", error: "Invalid broadcast body." },
        { status: 400 },
      );
    }

    if (
      !isRecord(body) ||
      typeof body.eventId !== "string" ||
      body.payload === undefined
    ) {
      return Response.json(
        { code: "INVALID_BROADCAST", error: "Broadcast payload is invalid." },
        { status: 400 },
      );
    }

    const outbound = jsonMessage({
      eventId: body.eventId,
      payload: body.payload,
      sender: "system",
      sentAt: Date.now(),
      type: "broadcast",
    });
    fanOutBroadcast(this.ctx.getWebSockets("member"), outbound);
    return Response.json({ ok: true }, { status: 202 });
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
    fanOutBroadcast(this.ctx.getWebSockets("member"), outbound);
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
