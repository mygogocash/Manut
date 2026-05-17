import type { Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';

import type { CopilotChatOptions, PromptMessage } from './providers/types';

/**
 * Fire-and-forget bridge between the copilot providers and the M4
 * MnCostService. Provider files call this at the end of a successful
 * response (or stream); we resolve the cost service via ModuleRef with
 * `strict: false` so the provider survives in deployments where the
 * Manut module isn't loaded (`ENABLE_MANUT_MODULE=false`).
 *
 * CLAUDE.md scar #5 — cost emission MUST be fire-and-forget. This file
 * is the single chokepoint where we (a) guard against the unloaded
 * module and (b) swallow any post-resolve error so the streaming
 * response never sees an exception thrown from MnCostService.
 *
 * Token approximation: we use char-length / 4 for both input and output,
 * matching the heuristic in `auto-router.ts`. The Rust native dispatcher
 * doesn't surface real usage numbers to the TS layer yet (CLAUDE.md scar
 * #6), and a budget signal accurate to ~20% beats no signal at all.
 */

interface EmitProviderCostInput {
  provider: string;
  model: string;
  messages: PromptMessage[];
  outputText?: string;
  outputTextLength?: number;
  options?: CopilotChatOptions;
}

interface CostServiceLike {
  emit: (input: {
    workspaceId: string;
    projectId?: string | null;
    agentId?: string | null;
    taskId?: string | null;
    goalId?: string | null;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }) => Promise<string | null>;
}

function approxTokensFromChars(charCount: number): number {
  if (charCount <= 0) return 0;
  return Math.ceil(charCount / 4);
}

function totalInputChars(messages: PromptMessage[]): number {
  // PromptMessage.content is typed as `string` in this codebase
  // (see PureMessageSchema in providers/types.ts), so a single dimension
  // sum is enough. If a future change broadens it to a discriminated
  // union of parts, extend here.
  let total = 0;
  for (const m of messages) {
    if (typeof m.content === 'string') {
      total += m.content.length;
    }
  }
  return total;
}

/**
 * Extract scope fields from the chat options. Manut wires these in via
 * a side-channel on `options.metadata` at the resolver layer — see
 * `auto-router.ts` for where they're set. Returns the workspaceId if
 * present + the rest of the scope chain.
 */
function extractScope(options?: CopilotChatOptions): {
  workspaceId?: string;
  projectId?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  goalId?: string | null;
} {
  const metadata = (
    options as
      | undefined
      | (CopilotChatOptions & {
          manutScope?: {
            workspaceId?: string;
            projectId?: string | null;
            agentId?: string | null;
            taskId?: string | null;
            goalId?: string | null;
          };
        })
  )?.manutScope;
  if (!metadata) return {};
  return {
    workspaceId: metadata.workspaceId,
    projectId: metadata.projectId ?? null,
    agentId: metadata.agentId ?? null,
    taskId: metadata.taskId ?? null,
    goalId: metadata.goalId ?? null,
  };
}

/**
 * Resolve MnCostService via ModuleRef with `strict: false`. Returns
 * `null` when the service isn't registered (e.g. ENABLE_MANUT_MODULE
 * is false), so the caller can no-op instead of crashing.
 */
function resolveCostService(moduleRef: ModuleRef): CostServiceLike | null {
  try {
    // We use a string token import here so this file doesn't itself
    // import from the manut plugin (which would force a cyclic
    // dependency from the copilot module). The runtime lookup picks up
    // whatever provider was registered under the class name.
    //
    // Using `require` keeps the import lazy — if the manut plugin isn't
    // present at all (e.g. a slimmed-down deploy), `require` throws and
    // we fall through to null without poisoning the streaming response.
    // oxlint-disable-next-line no-var-requires
    const mod = require('../manut/manut-cost.service') as {
      MnCostService?: new (...args: unknown[]) => CostServiceLike;
    };
    if (!mod?.MnCostService) return null;
    const service = moduleRef.get(mod.MnCostService, { strict: false });
    if (service && typeof (service as CostServiceLike).emit === 'function') {
      return service as CostServiceLike;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget cost emission. Resolves the service, computes token
 * approximations, and dispatches the persistence call without awaiting.
 * Every failure is swallowed and logged at WARN.
 */
export function emitProviderCostEvent(
  moduleRef: ModuleRef,
  logger: Logger,
  input: EmitProviderCostInput
): void {
  const scope = extractScope(input.options);
  if (!scope.workspaceId) {
    // No workspace context means this is an internal probe (e.g. the
    // model-list refresh on startup). Nothing meaningful to bill against.
    return;
  }

  const service = resolveCostService(moduleRef);
  if (!service) return;

  const computedInputTokens = approxTokensFromChars(
    totalInputChars(input.messages)
  );

  const outputChars = input.outputTextLength ?? input.outputText?.length ?? 0;
  const outputTokens = approxTokensFromChars(outputChars);

  // Detach from the call stack. We deliberately do NOT await — the
  // streaming response must not be held up by the cost insert.
  service
    .emit({
      workspaceId: scope.workspaceId,
      projectId: scope.projectId ?? null,
      agentId: scope.agentId ?? null,
      taskId: scope.taskId ?? null,
      goalId: scope.goalId ?? null,
      provider: input.provider,
      model: input.model,
      inputTokens: computedInputTokens,
      outputTokens,
    })
    .catch((error: unknown) => {
      logger.warn(
        `cost emission failed (swallowed): ${error instanceof Error ? error.message : String(error)}`
      );
    });
}
