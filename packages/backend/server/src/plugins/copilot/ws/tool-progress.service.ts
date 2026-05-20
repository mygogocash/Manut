/**
 * Manut M1 — Epic E1.11: Tool progress fan-out service.
 *
 * Server-side hook for copilot tools that want to surface progress to the
 * WebSocket clients subscribed to a chat session room. Today the copilot
 * tools (doc-edit / data-view-filter / etc.) only signal start + result
 * via the SSE `StreamObject` stream; this service is the additive WS
 * surface for tools that want richer mid-flight progress (uploads,
 * batch operations, long doc edits).
 *
 * Usage:
 *
 *   constructor(private readonly progress: ToolProgressService) {}
 *
 *   await this.progress.emitToolStarted(sessionId, 'doc-edit', { docId });
 *   await this.progress.emitToolProgress(sessionId, 'doc-edit', 45);
 *   await this.progress.emitToolCompleted(sessionId, 'doc-edit', { ok: true });
 *
 * The implementation is intentionally thin — it delegates to the
 * `CopilotChatGateway` so the room-targeting + auth invariants live in
 * one place. Tools that don't care about WS progress can keep using the
 * SSE-only path; nothing breaks if no WS clients are listening.
 */

import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CopilotChatGateway } from './chat.gateway';

@Injectable()
export class ToolProgressService {
  /**
   * Map of (sessionId, toolName) -> in-flight toolCallId. Tools that
   * don't pass their own id get a stable one across start / progress /
   * completed so frontends can match them up.
   */
  private readonly inflightIds = new Map<string, string>();

  constructor(private readonly gateway: CopilotChatGateway) {}

  private inflightKey(sessionId: string, toolName: string): string {
    return `${sessionId}::${toolName}`;
  }

  private ensureToolCallId(
    sessionId: string,
    toolName: string,
    toolCallId?: string
  ): string {
    const key = this.inflightKey(sessionId, toolName);
    if (toolCallId) {
      this.inflightIds.set(key, toolCallId);
      return toolCallId;
    }
    const existing = this.inflightIds.get(key);
    if (existing) return existing;
    const fresh = randomUUID();
    this.inflightIds.set(key, fresh);
    return fresh;
  }

  emitToolStarted(
    sessionId: string,
    toolName: string,
    args: Record<string, unknown>,
    toolCallId?: string
  ): void {
    const id = this.ensureToolCallId(sessionId, toolName, toolCallId);
    this.gateway.emitToolCallStart(sessionId, {
      toolCallId: id,
      toolName,
      args,
    });
  }

  emitToolProgress(
    sessionId: string,
    toolName: string,
    percent: number,
    toolCallId?: string
  ): void {
    const id = this.ensureToolCallId(sessionId, toolName, toolCallId);
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.gateway.emitToolProgress(sessionId, {
      toolCallId: id,
      toolName,
      percent: clamped,
    });
  }

  emitToolCompleted(
    sessionId: string,
    toolName: string,
    result: unknown,
    args: Record<string, unknown> = {},
    toolCallId?: string
  ): void {
    const id = this.ensureToolCallId(sessionId, toolName, toolCallId);
    this.gateway.emitToolCallResult(sessionId, {
      toolCallId: id,
      toolName,
      args,
      result,
    });
    // Drop the inflight id so a future invocation of the same tool in
    // the same session gets a fresh id.
    this.inflightIds.delete(this.inflightKey(sessionId, toolName));
  }
}
