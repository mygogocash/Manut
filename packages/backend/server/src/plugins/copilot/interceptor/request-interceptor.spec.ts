import test from 'ava';

import type { PromptMessage, PromptParams } from '../providers/types.js';
import {
  type ChatRequestInterceptorInput,
  ChatRequestInterceptorService,
} from './request-interceptor.js';

type MemoryContext = {
  workspaceId: string;
  userId: string;
  query: string;
  topK?: number;
};

type FakePromptService = {
  calls: MemoryContext[];
  injectMemoriesIntoMessages: (
    messages: PromptMessage[],
    context: MemoryContext
  ) => Promise<PromptMessage[]>;
};

function makeMessages(): PromptMessage[] {
  return [
    {
      role: 'system',
      content: 'You are Manut AI.',
    },
    {
      role: 'user',
      content: 'What changed in the launch plan?',
    },
  ];
}

function makeParams(): PromptParams {
  return {
    content: 'What changed in the launch plan?',
  };
}

function makePromptService(
  handler?: (
    messages: PromptMessage[],
    context: MemoryContext
  ) => Promise<PromptMessage[]>
): FakePromptService {
  return {
    calls: [],
    async injectMemoriesIntoMessages(messages, context) {
      this.calls.push(context);
      return handler ? handler(messages, context) : messages;
    },
  };
}

function makeService(promptService: FakePromptService) {
  const service = new ChatRequestInterceptorService();
  (service as unknown as { promptService: FakePromptService }).promptService =
    promptService;
  return service;
}

test('ChatRequestInterceptorService.intercept__given_memory_enabled_and_query__then_injects_relevant_memories', async t => {
  const messages = makeMessages();
  const params = makeParams();
  const injected = [
    {
      role: 'system',
      content: '<memories>launch plan context</memories>',
    },
    ...messages,
  ] satisfies PromptMessage[];
  const promptService = makePromptService(async () => injected);
  const service = makeService(promptService);

  const input: ChatRequestInterceptorInput = {
    messages,
    params,
    userId: 'user-1',
    workspaceId: 'ws-1',
    sessionId: 'session-1',
    query: 'What changed in the launch plan?',
    toolsConfig: { memory: true },
  };
  const result = await service.intercept(input);

  t.deepEqual(promptService.calls, [
    {
      workspaceId: 'ws-1',
      userId: 'user-1',
      query: 'What changed in the launch plan?',
      topK: 5,
    },
  ]);
  t.is(result.messages, injected);
  t.is(result.params, params);
});

test('ChatRequestInterceptorService.intercept__given_memory_opt_out__then_preserves_messages_without_retrieval', async t => {
  const messages = makeMessages();
  const params = makeParams();
  const promptService = makePromptService(async () => t.fail());
  const service = makeService(promptService);

  const input: ChatRequestInterceptorInput = {
    messages,
    params,
    userId: 'user-1',
    workspaceId: 'ws-1',
    sessionId: 'session-1',
    query: 'What changed in the launch plan?',
    toolsConfig: { memory: false },
  };
  const result = await service.intercept(input);

  t.deepEqual(promptService.calls, []);
  t.is(result.messages, messages);
  t.is(result.params, params);
});

test('ChatRequestInterceptorService.intercept__given_memory_injection_failure__then_returns_original_request', async t => {
  const messages = makeMessages();
  const params = makeParams();
  const promptService = makePromptService(async () => {
    throw new Error('memory backend unavailable');
  });
  const service = makeService(promptService);

  const input: ChatRequestInterceptorInput = {
    messages,
    params,
    userId: 'user-1',
    workspaceId: 'ws-1',
    sessionId: 'session-1',
    query: 'What changed in the launch plan?',
    toolsConfig: { memory: true },
  };
  const result = await service.intercept(input);

  t.is(promptService.calls.length, 1);
  t.is(result.messages, messages);
  t.is(result.params, params);
});
