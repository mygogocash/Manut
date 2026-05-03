import { Logger } from '@nestjs/common';

import type { PromptMessage } from './providers/types';

const logger = new Logger('CopilotAutoRouter');

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
