import type { PromptMessage, StreamObject } from '../providers/types';
import { CopilotProviderType } from '../providers/types';

const CACHE_CAPABLE_PROVIDERS = new Set<string>([
  CopilotProviderType.Anthropic,
  CopilotProviderType.AnthropicVertex,
]);

const DYNAMIC_PRIVATE_CONTENT_PATTERNS = [
  /<memories\b/i,
  /<content[_-]?fragments\b/i,
  /<fragment\b[^>]*(docId|blobId|fileId|workspaceId)=/i,
  /<document\b[^>]*(docId|workspaceId)=/i,
];

const WORKSPACE_SOURCE_TOOL_NAMES = new Set([
  'doc_hybrid_search',
  'doc_keyword_search',
  'doc_read',
  'doc_semantic_search',
]);

export type PromptCachePlanReason =
  | 'disabled-by-config'
  | 'dynamic-private-context'
  | 'empty-prefix'
  | 'stable-prefix'
  | 'unsupported-provider';

export type PromptCachePlan =
  | {
      status: 'eligible';
      reason: 'stable-prefix';
      cacheableMessageCount: number;
    }
  | {
      status: 'disabled';
      reason: Exclude<PromptCachePlanReason, 'stable-prefix'>;
      cacheableMessageCount: 0;
    };

export interface PromptCachePlanInput {
  providerType?: CopilotProviderType | string;
  messages: PromptMessage[];
  enabled?: boolean;
}

export function planPromptCache(input: PromptCachePlanInput): PromptCachePlan {
  if (input.enabled === false) {
    return disabled('disabled-by-config');
  }

  if (!input.providerType || !CACHE_CAPABLE_PROVIDERS.has(input.providerType)) {
    return disabled('unsupported-provider');
  }

  if (containsDynamicPrivateContext(input.messages)) {
    return disabled('dynamic-private-context');
  }

  const cacheableMessageCount = countStableSystemPrefix(input.messages);
  if (cacheableMessageCount === 0) {
    return disabled('empty-prefix');
  }

  return {
    status: 'eligible',
    reason: 'stable-prefix',
    cacheableMessageCount,
  };
}

function disabled(
  reason: Exclude<PromptCachePlanReason, 'stable-prefix'>
): PromptCachePlan {
  return {
    status: 'disabled',
    reason,
    cacheableMessageCount: 0,
  };
}

function countStableSystemPrefix(messages: PromptMessage[]) {
  let count = 0;
  for (const message of messages) {
    if (message.role !== 'system') {
      break;
    }
    if (!message.content.trim()) {
      break;
    }
    count += 1;
  }
  return count;
}

function containsDynamicPrivateContext(messages: PromptMessage[]) {
  return messages.some(message => {
    if (
      DYNAMIC_PRIVATE_CONTENT_PATTERNS.some(pattern =>
        pattern.test(message.content)
      )
    ) {
      return true;
    }
    return message.streamObjects?.some(isWorkspaceSourceToolResult) ?? false;
  });
}

function isWorkspaceSourceToolResult(streamObject: StreamObject) {
  return (
    streamObject.type === 'tool-result' &&
    WORKSPACE_SOURCE_TOOL_NAMES.has(streamObject.toolName)
  );
}
