import test from 'ava';

import { CopilotProviderType } from '../providers/types.js';
import { planPromptCache } from './provider-cache-planner.js';

test('planPromptCache__given_stable_system_prompt__then_marks_cacheable_prefix', t => {
  const result = planPromptCache({
    providerType: CopilotProviderType.AnthropicVertex,
    messages: [
      {
        role: 'system',
        content: 'You are Manut AI. Answer clearly and cite sources.',
      },
      {
        role: 'user',
        content: 'Summarize this workspace.',
      },
    ],
  });

  t.like(result, {
    status: 'eligible',
    cacheableMessageCount: 1,
    reason: 'stable-prefix',
  });
});

test('planPromptCache__given_retrieved_private_doc__then_refuses_cache_marker', t => {
  const result = planPromptCache({
    providerType: CopilotProviderType.AnthropicVertex,
    messages: [
      {
        role: 'system',
        content:
          '<content_fragments><fragment docId="doc-1">Private roadmap</fragment></content_fragments>',
      },
      {
        role: 'user',
        content: 'What is in the roadmap?',
      },
    ],
  });

  t.like(result, {
    status: 'disabled',
    cacheableMessageCount: 0,
    reason: 'dynamic-private-context',
  });
});

test('planPromptCache__given_cache_unsupported_provider__then_omits_cache_metadata', t => {
  const result = planPromptCache({
    providerType: CopilotProviderType.GeminiVertex,
    messages: [
      {
        role: 'system',
        content: 'You are Manut AI.',
      },
      {
        role: 'user',
        content: 'Hello',
      },
    ],
  });

  t.like(result, {
    status: 'disabled',
    cacheableMessageCount: 0,
    reason: 'unsupported-provider',
  });
});
