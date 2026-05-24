import { Injectable } from '@nestjs/common';

import type { PromptMessage, PromptParams } from '../providers/types';

export interface ChatRequestInterceptorInput {
  messages: PromptMessage[];
  params: PromptParams;
  userId: string;
  workspaceId: string;
  sessionId: string;
  query?: string;
}

export interface ChatRequestInterceptorResult {
  messages: PromptMessage[];
  params: PromptParams;
}

/**
 * Non-destructive wrapper seam for chat-request enrichment.
 *
 * This intentionally starts as a pass-through so it can be wired into the
 * hot chat path without changing response behavior. Identity context,
 * memory context, retrieval hints, and provider cache planning should be
 * added here behind focused tests instead of growing CopilotController.
 */
@Injectable()
export class ChatRequestInterceptorService {
  async intercept(
    input: ChatRequestInterceptorInput
  ): Promise<ChatRequestInterceptorResult> {
    return {
      messages: input.messages,
      params: input.params,
    };
  }
}
