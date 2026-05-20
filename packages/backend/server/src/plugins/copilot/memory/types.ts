/**
 * Manut Wave 4 (M5b) — Memory MVP type surface.
 *
 * Scope semantics
 * ---------------
 * `user`      — only the user who ingested the memory can retrieve it.
 *               Used for personal preferences and per-user playbooks.
 * `workspace` — any member of the workspace can retrieve. Used for
 *               team-wide facts, decisions, and shared playbooks.
 *
 * Kind semantics (see CLAUDE.md history-of-bites + plan §A3)
 * ----------------------------------------------------------
 * FACT        — statement of truth ("user prefers TypeScript").
 * DECISION    — recorded choice ("we shipped vertex over openai").
 * OBSERVATION — free-form note captured during a run.
 * PLAYBOOK    — reusable how-to step the model should prioritise
 *               over OBSERVATION when both are top-K.
 *
 * Keep `MemoryKind` and `MemoryScope` as string-literal unions, not enums,
 * per the project's TS coding-style (prefer unions for clarity and to
 * avoid the runtime cost of enum reverse-mapping).
 */

export type MemoryKind = 'FACT' | 'DECISION' | 'OBSERVATION' | 'PLAYBOOK';
export type MemoryScope = 'user' | 'workspace';

/**
 * Inbound shape for `MemoryIngestService.ingest`. `taskId` and `agentId`
 * remain optional so the simplest "Manut chat just learned a thing"
 * path doesn't have to know about agent or task ids — they default to
 * sentinel `unscoped` values that schema.prisma's `@db.VarChar` accepts.
 */
export interface IngestMemoryInput {
  workspaceId: string;
  userId: string;
  scope: MemoryScope;
  kind: MemoryKind;
  content: string;
  /** Optional pinning — pinned memories surface ahead of unpinned ones. */
  pinned?: boolean;
  /** Optional project / agent / task IDs. Default to the `unscoped` sentinel. */
  projectId?: string;
  agentId?: string;
  taskId?: string;
  /** Importance band 1-10 for the existing ranking — defaults to 1. */
  importance?: number;
}

/**
 * Outbound shape for `MemoryRetrieveService.retrieve`. We expose just the
 * fields the system-prompt formatter cares about (`content`, `kind`,
 * `scope`) plus an audit trail (`id`, `createdAt`) so callers can log
 * which memories shaped a given chat turn.
 */
export interface RetrievedMemory {
  id: string;
  content: string;
  kind: MemoryKind;
  scope: MemoryScope;
  createdAt: Date;
}

export interface RetrieveMemoryInput {
  /** The user's most recent message — drives the kNN query. */
  query: string;
  workspaceId: string;
  userId: string;
  /** Which scopes to search. Default = ['user', 'workspace']. */
  scopes?: ReadonlyArray<MemoryScope>;
  /** Max memories to return. Default = 5. */
  topK?: number;
}
