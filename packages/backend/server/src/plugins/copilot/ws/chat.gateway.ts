/**
 * Manut M1 — Epic E1.11: WebSocket transport for AI chat.
 *
 * Parallel transport to the existing SSE `/api/copilot/chat/:sessionId/stream-object`
 * endpoint (controller.ts). Per plan decision #23, SSE stays live for 30
 * days as the fallback — this gateway ADDS the WS path; it does not
 * replace anything. Frontend opt-in via the `ws_transport` feature flag.
 *
 * Lifecycle
 * ---------
 *   1. Client opens namespace `/copilot-chat` (socket.io).
 *   2. Server resolves user from the request session/token (same pattern as
 *      `SpaceSyncGateway.attachPresenceUserId`). Unauthenticated sockets
 *      are immediately disconnected.
 *   3. Client emits `subscribe { sessionId }`. Gateway validates the
 *      session belongs to the user (via ChatSessionService.get) and
 *      joins the socket to `session:<sessionId>` AND
 *      `workspace:<workspaceId>` rooms.
 *   4. Server emits `token-delta` / `reasoning` / `tool-call-*` / `done`
 *      / `error` to the session room. Tool-progress fan-out is driven by
 *      ToolProgressService. Memory-write fan-out is driven by
 *      MemoryPushService.
 *   5. On disconnect or `cancel`, rooms are cleared and (TODO future)
 *      the upstream stream is aborted.
 */

import { Injectable, Logger, UseInterceptors } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Request } from 'express';
import { ClsInterceptor } from 'nestjs-cls';
import { type Server, Socket } from 'socket.io';

import { ChatSessionService } from '../session';
import {
  type CancelMessage,
  sessionRoom,
  type SubscribeMessage as ChatSubscribeMessage,
  type UnsubscribeMessage,
  workspaceRoom,
  WS_CHAT_CLIENT_EVENTS,
  WS_CHAT_EVENTS,
  WS_CHAT_NAMESPACE,
} from './chat.events';

const SOCKET_USER_ID_KEY = 'copilotChatUserId';
const SOCKET_SESSION_ID_KEY = 'copilotChatSessionId';
const SOCKET_WORKSPACE_ID_KEY = 'copilotChatWorkspaceId';

interface AuthedSocketData {
  [SOCKET_USER_ID_KEY]?: string;
  [SOCKET_SESSION_ID_KEY]?: string;
  [SOCKET_WORKSPACE_ID_KEY]?: string;
}

/**
 * Resolves the authenticated user id from the upgrade request, mirroring
 * the proven path used by `SpaceSyncGateway`. Session cookies and bearer
 * tokens both produce a populated `request.session` / `request.token`
 * via the Auth module's request decorators by the time the WS handshake
 * completes.
 */
function resolveUserId(client: Socket): string | null {
  const request = client.request as Request;
  const userId = request.session?.user.id ?? request.token?.user.id;
  if (typeof userId !== 'string' || !userId) {
    return null;
  }
  return userId;
}

@Injectable()
@WebSocketGateway({
  namespace: WS_CHAT_NAMESPACE,
  // CORS comes from the upstream socket.io adapter config; explicit `true`
  // is intentionally avoided — we let the platform-wide CORS contract
  // apply so dev/prod hosts stay aligned.
})
@UseInterceptors(ClsInterceptor)
export class CopilotChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CopilotChatGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly sessionService: ChatSessionService) {}

  // --- Lifecycle ----------------------------------------------------------

  handleConnection(client: Socket): void {
    const userId = resolveUserId(client);
    if (!userId) {
      this.logger.warn(
        `Rejecting unauthenticated copilot-chat connection ${client.id}`
      );
      // Give socket.io a tick to flush handshake response before kicking.
      setImmediate(() => client.disconnect(true));
      return;
    }
    (client.data as AuthedSocketData)[SOCKET_USER_ID_KEY] = userId;
    this.logger.debug(`copilot-chat WS connect ${client.id} user=${userId}`);
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as AuthedSocketData;
    this.logger.debug(
      `copilot-chat WS disconnect ${client.id} session=${
        data[SOCKET_SESSION_ID_KEY] ?? 'none'
      }`
    );
    // socket.io clears room membership automatically on disconnect.
  }

  // --- Client -> Server messages ------------------------------------------

  @SubscribeMessage(WS_CHAT_CLIENT_EVENTS.SUBSCRIBE)
  async onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatSubscribeMessage
  ): Promise<{ ok: boolean; error?: string }> {
    const data = client.data as AuthedSocketData;
    const userId = data[SOCKET_USER_ID_KEY];
    if (!userId) {
      return { ok: false, error: 'unauthenticated' };
    }
    const sessionId = body?.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, error: 'missing-session-id' };
    }
    let workspaceId: string | undefined;
    try {
      const session = await this.sessionService.get(sessionId);
      if (!session) {
        return { ok: false, error: 'session-not-found' };
      }
      // Per session.ts:108 the ChatSessionState exposes userId/workspaceId.
      // Defensive access: the public ChatSession type doesn't surface these
      // directly, but the underlying `config` does. We rely on the same
      // structural contract that controller.ts uses (`session.config.workspaceId`).
      const config = (
        session as unknown as {
          config?: { userId?: string; workspaceId?: string };
        }
      ).config;
      if (!config || config.userId !== userId) {
        return { ok: false, error: 'session-access-denied' };
      }
      workspaceId = config.workspaceId;
    } catch (err) {
      this.logger.warn(
        `subscribe: session lookup failed for ${sessionId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return { ok: false, error: 'session-lookup-failed' };
    }
    data[SOCKET_SESSION_ID_KEY] = sessionId;
    if (workspaceId) {
      data[SOCKET_WORKSPACE_ID_KEY] = workspaceId;
      await client.join(workspaceRoom(workspaceId));
    }
    await client.join(sessionRoom(sessionId));
    return { ok: true };
  }

  @SubscribeMessage(WS_CHAT_CLIENT_EVENTS.UNSUBSCRIBE)
  async onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() _body: UnsubscribeMessage
  ): Promise<{ ok: boolean }> {
    const data = client.data as AuthedSocketData;
    const sessionId = data[SOCKET_SESSION_ID_KEY];
    const workspaceId = data[SOCKET_WORKSPACE_ID_KEY];
    if (sessionId) {
      await client.leave(sessionRoom(sessionId));
      data[SOCKET_SESSION_ID_KEY] = undefined;
    }
    if (workspaceId) {
      await client.leave(workspaceRoom(workspaceId));
      data[SOCKET_WORKSPACE_ID_KEY] = undefined;
    }
    return { ok: true };
  }

  @SubscribeMessage(WS_CHAT_CLIENT_EVENTS.CANCEL)
  async onCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() _body: CancelMessage
  ): Promise<{ ok: boolean }> {
    const data = client.data as AuthedSocketData;
    const sessionId = data[SOCKET_SESSION_ID_KEY];
    if (!sessionId) return { ok: true };
    // Stream abort wiring is deferred — the provider stream lives in
    // controller.ts and is driven by the HTTP request lifecycle. Once
    // chat invocation also runs through this gateway, we'll thread an
    // AbortController per session here. For now, leave the room so the
    // client stops receiving deltas.
    await client.leave(sessionRoom(sessionId));
    data[SOCKET_SESSION_ID_KEY] = undefined;
    return { ok: true };
  }

  // --- Server -> Client emitters ------------------------------------------
  //
  // The methods below are called from the controller / tool-progress
  // / memory-push services. They are *thin* — keep them dumb wrappers so
  // the gateway stays easy to test in isolation.

  emitTokenDelta(sessionId: string, content: string): void {
    this.server
      .to(sessionRoom(sessionId))
      .emit(WS_CHAT_EVENTS.TOKEN_DELTA, { content });
  }

  emitReasoning(sessionId: string, content: string): void {
    this.server
      .to(sessionRoom(sessionId))
      .emit(WS_CHAT_EVENTS.REASONING, { content });
  }

  emitToolCallStart(
    sessionId: string,
    payload: {
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  ): void {
    this.server
      .to(sessionRoom(sessionId))
      .emit(WS_CHAT_EVENTS.TOOL_CALL_START, payload);
  }

  emitToolCallResult(
    sessionId: string,
    payload: {
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      result: unknown;
    }
  ): void {
    this.server
      .to(sessionRoom(sessionId))
      .emit(WS_CHAT_EVENTS.TOOL_CALL_RESULT, payload);
  }

  emitToolProgress(
    sessionId: string,
    payload: { toolCallId: string; toolName: string; percent: number }
  ): void {
    this.server
      .to(sessionRoom(sessionId))
      .emit(WS_CHAT_EVENTS.TOOL_PROGRESS, payload);
  }

  emitMemoryPushed(
    workspaceId: string,
    payload: {
      kind: string;
      content: string;
      scope: 'user' | 'workspace';
      userId: string | null;
    }
  ): void {
    this.server
      .to(workspaceRoom(workspaceId))
      .emit(WS_CHAT_EVENTS.MEMORY_PUSHED, { ...payload, workspaceId });
  }

  emitDone(sessionId: string): void {
    this.server.to(sessionRoom(sessionId)).emit(WS_CHAT_EVENTS.DONE, {});
  }

  emitError(sessionId: string, message: string, code?: string): void {
    this.server
      .to(sessionRoom(sessionId))
      .emit(WS_CHAT_EVENTS.ERROR, { message, code });
  }
}
