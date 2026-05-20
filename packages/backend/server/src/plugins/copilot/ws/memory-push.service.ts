/**
 * Manut M1 — Epic E1.11: Memory write fan-out service.
 *
 * Thin shim that turns a freshly-ingested memory into a workspace-scoped
 * `memory-pushed` WS event. Wired so MemoryIngestService can call into
 * this *after* a successful `INSERT`, without bringing the WS gateway
 * into its own dependency surface (memory is best-effort; WS push is
 * doubly best-effort).
 *
 * The fan-out target is the workspace room (`workspace:<id>`), not the
 * session room — memories can be triggered by chat turns in OTHER
 * sessions and we still want every connected client to see the badge.
 *
 * No filter on the user side: workspace-scoped memories surface to all
 * members (matches the read path in MemoryRetrieveService); user-scoped
 * memories carry `userId` on the event so the client decides whether
 * to surface them.
 */

import { Injectable } from '@nestjs/common';

import { CopilotChatGateway } from './chat.gateway';

export interface MemoryPushPayload {
  workspaceId: string;
  /** null for workspace-scope memories; populated for user-scope. */
  userId: string | null;
  scope: 'user' | 'workspace';
  /** MnMemoryKind — FACT / DECISION / OBSERVATION / PLAYBOOK */
  kind: string;
  /** Short snippet — full row stays in mn_agent_memories. */
  content: string;
}

@Injectable()
export class MemoryPushService {
  constructor(private readonly gateway: CopilotChatGateway) {}

  /**
   * Fan a memory write out to every WS client subscribed to the
   * workspace. Safe to call from a `void` continuation — the gateway
   * swallows missing-room emits silently.
   */
  notifyWorkspace(payload: MemoryPushPayload): void {
    const { workspaceId, userId, scope, kind, content } = payload;
    // Cap the snippet length so we don't blast big PII over the wire.
    const trimmed =
      content.length > 280 ? `${content.slice(0, 280)}...` : content;
    this.gateway.emitMemoryPushed(workspaceId, {
      kind,
      content: trimmed,
      scope,
      userId,
    });
  }
}
