import { logAudit } from "@/infrastructure/audit/audit.service";

// AI Project Orchestrator — Phase 7 (AI Audit). Records METADATA ONLY for every
// AI invocation via the existing immutable audit log — never the prompt, never
// the model's chain-of-thought / hidden reasoning, never the raw output. Uses
// the shared logAudit sink (no new logging framework).

export interface AiInvocationMeta {
  /** Logical operation, e.g. "orchestrator.task_decomposition". */
  operation: string;
  modelVersion: string;
  promptVersion: string;
  /** Wall-clock execution time in ms. */
  executionMs: number;
  /** "ai" when the model answered, "heuristic" when it fell back. */
  source: "ai" | "heuristic";
  /** Optional structured-output schema version. */
  outputVersion?: string;
  /** Optional model-reported confidence (label or 0-1). */
  confidence?: string | number;
  /** Optional token usage {input, output, total}. */
  tokens?: { input?: number; output?: number; total?: number };
  /** Optional retry attempts spent. */
  retries?: number;
  userId?: string;
  resourceId?: string;
}

export async function recordAiInvocation(
  meta: AiInvocationMeta,
): Promise<void> {
  // Best-effort — logAudit already swallows its own errors so an audit-write
  // failure never affects the caller (fault isolation).
  await logAudit({
    userId: meta.userId,
    action: "ai.invocation",
    resource: "ai",
    resourceId: meta.resourceId,
    details: {
      operation: meta.operation,
      modelVersion: meta.modelVersion,
      promptVersion: meta.promptVersion,
      executionMs: meta.executionMs,
      source: meta.source,
      outputVersion: meta.outputVersion ?? null,
      confidence: meta.confidence ?? null,
      tokensInput: meta.tokens?.input ?? null,
      tokensOutput: meta.tokens?.output ?? null,
      tokensTotal: meta.tokens?.total ?? null,
      retries: meta.retries ?? 0,
      // NOTE: prompt text and chain-of-thought are intentionally excluded.
    },
  });
}
