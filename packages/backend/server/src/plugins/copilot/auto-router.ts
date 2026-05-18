import { Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';

import type { PromptMessage } from './providers/types';

const logger = new Logger('CopilotAutoRouter');

/**
 * M4 budget gate. Resolves `MnBudgetEnforcerService` via ModuleRef with
 * `strict: false` so the gate is a no-op when the Manut module isn't
 * loaded (e.g. `ENABLE_MANUT_MODULE=false`). Coordinate with Branch B's
 * goal-context prepend: goal-context is logical context (first), the
 * budget check is the gate (second), so an over-budget user gets blocked
 * BEFORE any provider work fires.
 *
 * Throws the enforcer's structured `BudgetExceededError` on hard-stop;
 * the auto-router's caller is responsible for translating to a
 * UserFriendlyError if it wants to expose the message to the client.
 */
export async function assertBudgetAllowed(
  moduleRef: ModuleRef,
  scope: {
    workspaceId: string;
    projectId?: string | null;
    agentId?: string | null;
    taskId?: string | null;
    goalId?: string | null;
  }
): Promise<void> {
  try {
    // Lazy require to keep this file independent of the manut plugin
    // import graph (avoids a cycle through copilot/providers).
    // oxlint-disable-next-line no-var-requires
    const mod = require('../manut/manut-budget-enforcer.service') as {
      MnBudgetEnforcerService?: new (...args: unknown[]) => {
        assertAllowed: (chain: typeof scope) => Promise<unknown>;
      };
    };
    if (!mod?.MnBudgetEnforcerService) return;
    const enforcer = moduleRef.get(mod.MnBudgetEnforcerService, {
      strict: false,
    });
    if (!enforcer || typeof enforcer.assertAllowed !== 'function') return;
    await enforcer.assertAllowed(scope);
  } catch (error) {
    // The enforcer's BudgetExceededError is the only re-throw class —
    // every other error (require failure, no-provider, transient DB
    // hiccup) is a non-event for the gate. We detect by name to avoid
    // an import dependency on the error class.
    if (
      error &&
      typeof error === 'object' &&
      (error as { name?: string }).name === 'BudgetExceededError'
    ) {
      throw error;
    }
    logger.warn(
      `budget gate resolution failed (allowing): ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Sentinel values that cause the model resolver to delegate the choice
 * to {@link routeAutoModel}. Either may appear as the requested model id
 * or as the prompt name.
 */
export const AUTO_ROUTE_SENTINELS = new Set(['auto', 'router', 'autopilot']);

export type AutoRouteReason =
  | 'short-text'
  | 'image-input'
  | 'long-context'
  | 'code-heavy'
  | 'default';

export interface AutoRouteDecision {
  modelId: string;
  reason: AutoRouteReason;
  /** Free-form description suitable for surfacing to the user. */
  explanation: string;
  /** Approximate input token count used in the heuristic. */
  approxInputTokens: number;
  /** Whether the input contains any image attachment. */
  hasImage: boolean;
}

/** Default destination targets — kept here so the heuristic stays in one place. */
export const AUTO_ROUTE_TARGETS = {
  fast: 'gemini-2.5-flash',
  balanced: 'gemini-2.5-flash',
  longContext: 'gemini-2.5-pro',
  code: 'claude-sonnet-4-5@20250929',
  multimodalFast: 'gemini-2.5-flash',
} as const;

const SHORT_TEXT_TOKEN_THRESHOLD = 1_000;
const LONG_CONTEXT_TOKEN_THRESHOLD = 30_000;

const CODE_FENCE_PATTERN = /```[\s\S]*?```/;
const CODE_KEYWORD_PATTERN =
  /\b(function|class|const|let|var|import\s+\w|return|=>|interface|implements|extends|async\s+function|public\s+\w|private\s+\w|null\s*pointer|stack\s*trace|exception|traceback)\b/i;

function isAutoSentinel(value?: string | null): boolean {
  if (!value) return false;
  return AUTO_ROUTE_SENTINELS.has(value.trim().toLowerCase());
}

function approxTokenCount(text: string): number {
  if (!text) return 0;
  // Cheap heuristic — roughly 4 characters per token, matches OpenAI's
  // ballpark for English. Off by ~30% for Asian scripts but still good
  // enough for routing decisions.
  return Math.ceil(text.length / 4);
}

function messageHasImage(message: PromptMessage): boolean {
  if (!Array.isArray(message.attachments)) return false;
  for (const attachment of message.attachments) {
    if (typeof attachment === 'string') {
      if (attachment.startsWith('data:image/')) return true;
      const lower = attachment.toLowerCase();
      if (
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.gif')
      ) {
        return true;
      }
      continue;
    }
    if ('attachment' in attachment) {
      if (attachment.mimeType?.startsWith('image/')) return true;
      continue;
    }
    if (
      (attachment.kind === 'data' || attachment.kind === 'bytes') &&
      attachment.mimeType?.startsWith('image/')
    ) {
      return true;
    }
    if (attachment.kind === 'url') {
      if (attachment.mimeType?.startsWith('image/')) return true;
      if (attachment.url.startsWith('data:image/')) return true;
    }
  }
  return false;
}

/**
 * Quick, deterministic classifier for routing `auto` sessions to the right
 * underlying model. Cheap to run on every session creation — no external
 * calls, no model invocations.
 *
 * Heuristic order (first match wins):
 *   1. Image input → multimodal-fast model.
 *   2. > LONG_CONTEXT_TOKEN_THRESHOLD tokens → long-context model.
 *   3. Code-heavy (triple-backtick blocks or strong code keywords) → code model.
 *   4. < SHORT_TEXT_TOKEN_THRESHOLD tokens → fast model.
 *   5. Default → fast model.
 */
export function routeAutoModel(messages: PromptMessage[]): AutoRouteDecision {
  const userMessages = messages.filter(m => m.role === 'user');
  const targetMessages = userMessages.length ? userMessages : messages;

  const combined = targetMessages.map(m => m.content ?? '').join('\n');
  const approxInputTokens = approxTokenCount(combined);
  const hasImage = targetMessages.some(messageHasImage);
  const hasCodeFence = CODE_FENCE_PATTERN.test(combined);
  const hasCodeKeyword = CODE_KEYWORD_PATTERN.test(combined);

  let modelId: string;
  let reason: AutoRouteReason;
  let explanation: string;

  if (hasImage) {
    modelId = AUTO_ROUTE_TARGETS.multimodalFast;
    reason = 'image-input';
    explanation = `image attachment detected, routing to ${modelId} for multimodal speed`;
  } else if (approxInputTokens > LONG_CONTEXT_TOKEN_THRESHOLD) {
    modelId = AUTO_ROUTE_TARGETS.longContext;
    reason = 'long-context';
    explanation = `long input (~${approxInputTokens} tokens), routing to ${modelId} for 1M context`;
  } else if (hasCodeFence || hasCodeKeyword) {
    modelId = AUTO_ROUTE_TARGETS.code;
    reason = 'code-heavy';
    explanation = `code-heavy input, routing to ${modelId}`;
  } else if (approxInputTokens < SHORT_TEXT_TOKEN_THRESHOLD) {
    modelId = AUTO_ROUTE_TARGETS.fast;
    reason = 'short-text';
    explanation = `short text (~${approxInputTokens} tokens), routing to ${modelId}`;
  } else {
    modelId = AUTO_ROUTE_TARGETS.balanced;
    reason = 'default';
    explanation = `balanced default, routing to ${modelId}`;
  }

  logger.log(
    `[auto-router] picked ${modelId} (reason=${reason}, tokens≈${approxInputTokens}, image=${hasImage})`
  );

  return { modelId, reason, explanation, approxInputTokens, hasImage };
}

/**
 * True if the supplied identifier is a sentinel asking the router
 * to choose a model dynamically.
 */
export function isAutoModel(value?: string | null): boolean {
  return isAutoSentinel(value);
}

/**
 * True if the supplied prompt name is a sentinel asking the router
 * to choose a model dynamically.
 */
export function isAutoPromptName(value?: string | null): boolean {
  return isAutoSentinel(value);
}

/**
 * Hard cap on the GOAL CONTEXT block that {@link injectGoalContext}
 * prepends to the system message. Mirrors `GOAL_CONTEXT_CHAR_CAP` from
 * `plugins/manut/manut-goal.dto.ts`. Duplicated here so the auto-router
 * stays decoupled from the manut plugin imports — both constants are
 * the same physical number; if either drifts, ship the smaller value.
 */
export const GOAL_CONTEXT_INJECTION_CAP = 500;

/**
 * Prepend a GOAL CONTEXT block to the prompt messages. The block is
 * inserted either:
 *   - INTO the existing first `system` message (joined with two
 *     newlines), or
 *   - As a NEW `system` message at index 0 when no system message exists.
 *
 * The injection is bounded by {@link GOAL_CONTEXT_INJECTION_CAP}; the
 * context string SHOULD already be capped by the caller
 * (`MnGoalContextService.buildContext` enforces the same limit) but we
 * trim defensively here too — a 5000-char system block is worse than a
 * missing one. Logs a warning when defensive truncation kicks in.
 *
 * Returns a NEW messages array — the input is never mutated, preserving
 * the immutability rule from CLAUDE.md.
 */
export function injectGoalContext(
  messages: PromptMessage[],
  context: string | null | undefined
): PromptMessage[] {
  if (!context || context.trim().length === 0) {
    return messages;
  }

  let safeContext = context;
  if (safeContext.length > GOAL_CONTEXT_INJECTION_CAP) {
    const suffix = ' … [truncated]';
    safeContext =
      safeContext.slice(0, GOAL_CONTEXT_INJECTION_CAP - suffix.length) + suffix;
    logger.warn(
      `[goal-context] injection trimmed from ${context.length} to ` +
        `${safeContext.length} chars (cap=${GOAL_CONTEXT_INJECTION_CAP})`
    );
  }

  const firstSystemIdx = messages.findIndex(m => m.role === 'system');
  if (firstSystemIdx === -1) {
    return [
      { role: 'system', content: safeContext } as PromptMessage,
      ...messages,
    ];
  }

  const updated = messages.slice();
  const original = updated[firstSystemIdx];
  updated[firstSystemIdx] = {
    ...original,
    content: `${safeContext}\n\n${original.content ?? ''}`,
  };
  return updated;
}

/**
 * M9 — Hard cap on the MEMORY RECALL block that {@link injectMemoryRecall}
 * prepends to the system message. Mirrors `GOAL_CONTEXT_INJECTION_CAP` to
 * keep the auto-router decoupled from the manut plugin; the block is
 * already line-capped at the service layer (`renderRecallBlock`) but a
 * defensive trim here protects against runaway recall outputs.
 */
export const MEMORY_RECALL_INJECTION_CAP = 1500;

/**
 * Prepend a MEMORY RECALL block to the prompt messages. Same insertion
 * shape as {@link injectGoalContext}: joins into the existing first
 * `system` message (with two newlines) or inserts a new system message
 * at index 0 if none exists.
 *
 * The recall block SHOULD already be capped + formatted by
 * `MnAgentMemoryService.renderRecallBlock`; we trim defensively here.
 *
 * Returns a NEW messages array — input is never mutated.
 *
 * NOTE: This export is the pure helper. Wiring it into the live
 * session.ts flow is deferred to a follow-up commit so we can land the
 * M9 surface (schema + service + resolver + tests) on its own and
 * verify the recall path independently of the streaming code path.
 */
export function injectMemoryRecall(
  messages: PromptMessage[],
  recallBlock: string | null | undefined
): PromptMessage[] {
  if (!recallBlock || recallBlock.trim().length === 0) {
    return messages;
  }

  let safeBlock = recallBlock;
  if (safeBlock.length > MEMORY_RECALL_INJECTION_CAP) {
    const suffix = ' … [truncated]';
    safeBlock =
      safeBlock.slice(0, MEMORY_RECALL_INJECTION_CAP - suffix.length) + suffix;
    logger.warn(
      `[memory-recall] injection trimmed from ${recallBlock.length} to ` +
        `${safeBlock.length} chars (cap=${MEMORY_RECALL_INJECTION_CAP})`
    );
  }

  const firstSystemIdx = messages.findIndex(m => m.role === 'system');
  if (firstSystemIdx === -1) {
    return [
      { role: 'system', content: safeBlock } as PromptMessage,
      ...messages,
    ];
  }

  const updated = messages.slice();
  const original = updated[firstSystemIdx];
  updated[firstSystemIdx] = {
    ...original,
    content: `${safeBlock}\n\n${original.content ?? ''}`,
  };
  return updated;
}
