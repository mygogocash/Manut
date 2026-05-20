/**
 * Manut M1 — Epic E1.11: WebSocket transport for AI chat.
 *
 * Typed event shapes shared between the NestJS gateway and the frontend
 * ws-transport. The SSE controller at `controller.ts` keeps emitting the
 * same `StreamObject` payloads for the next 30 days (flag-gated cutover);
 * the WS path mirrors them 1:1 so the frontend join layer
 * (request.ts -> parseTagCandidates) sees an identical stream regardless
 * of transport.
 *
 * Server -> Client events (emitted on the per-session room):
 *   - 'token-delta'      text streaming chunks
 *   - 'reasoning'        chain-of-thought chunks (mirrors SSE 'reasoning')
 *   - 'tool-call-start'  tool invocation begins (from ToolProgressService)
 *   - 'tool-call-result' tool invocation result (from ToolProgressService)
 *   - 'memory-pushed'    workspace memory write (from MemoryPushService)
 *   - 'done'             stream ended cleanly
 *   - 'error'            stream errored out
 *
 * Client -> Server events:
 *   - 'subscribe'        bind socket to a chat session room
 *   - 'unsubscribe'      detach from the room
 *   - 'cancel'           abort the in-flight stream for the bound session
 *
 * The shapes here are deliberately small — same surface area as the
 * upstream `StreamObject` schema (providers/types.ts) minus the
 * SSE-wrapper crud. We keep them as plain interfaces (not Zod) because
 * the gateway is the only emitter and we trust our own payloads on
 * the wire.
 */

export const WS_CHAT_NAMESPACE = '/copilot-chat';

export interface SubscribeMessage {
  sessionId: string;
}

export interface UnsubscribeMessage {}

export interface CancelMessage {}

export interface TokenDeltaEvent {
  /** The text chunk to append to the assistant turn. */
  content: string;
}

export interface ReasoningEvent {
  /** Chain-of-thought chunk; surfaced when the session has reasoning on. */
  content: string;
}

export interface ToolCallStartEvent {
  /** Stable id for matching against the eventual tool-call-result. */
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolCallResultEvent {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  /** Tool result payload — opaque to the gateway. */
  result: unknown;
}

export interface ToolProgressEvent {
  /** Stable id for matching across start / progress / completed. */
  toolCallId: string;
  toolName: string;
  /** 0-100 percent done. Tools without a measurable progress send 50. */
  percent: number;
}

export interface MemoryPushedEvent {
  /** Memory kind mirrored from MemoryIngestService (FACT / DECISION / ...) */
  kind: string;
  /** Short content snippet. The full row stays in mn_agent_memories. */
  content: string;
  scope: 'user' | 'workspace';
  /** Workspace id this memory belongs to — clients filter on this. */
  workspaceId: string;
  /** Optional user id for `user`-scope memories; null for `workspace`-scope. */
  userId: string | null;
}

export interface DoneEvent {}

export interface ErrorEvent {
  message: string;
  code?: string;
}

/**
 * Event-name constants — keep them stringly-typed at the boundary so the
 * client (which doesn't share this file) can hard-code the matching string.
 */
export const WS_CHAT_EVENTS = {
  TOKEN_DELTA: 'token-delta',
  REASONING: 'reasoning',
  TOOL_CALL_START: 'tool-call-start',
  TOOL_CALL_RESULT: 'tool-call-result',
  TOOL_PROGRESS: 'tool-progress',
  MEMORY_PUSHED: 'memory-pushed',
  DONE: 'done',
  ERROR: 'error',
} as const;

export const WS_CHAT_CLIENT_EVENTS = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  CANCEL: 'cancel',
} as const;

/**
 * Per-session room key. Sockets join `session:<sessionId>` on subscribe;
 * the gateway emits session-scoped events to that room.
 */
export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

/**
 * Per-workspace room key. Used by MemoryPushService to fan out memory
 * writes to every connected client in a workspace, regardless of their
 * current session subscription.
 */
export function workspaceRoom(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}
