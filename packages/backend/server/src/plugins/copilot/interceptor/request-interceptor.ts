import { Injectable, Logger } from '@nestjs/common';

import type { PromptService } from '../prompt';
import type { PromptMessage, PromptParams } from '../providers/types';
import type { ToolsConfig } from '../types';

export interface ChatRequestInterceptorInput {
  messages: PromptMessage[];
  params: PromptParams;
  userId: string;
  workspaceId: string;
  sessionId: string;
  query?: string;
  toolsConfig?: ToolsConfig;
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
  private readonly logger = new Logger(ChatRequestInterceptorService.name);

  constructor(
    private readonly promptService?: Pick<
      PromptService,
      'injectMemoriesIntoMessages'
    >
  ) {}

  async intercept(
    input: ChatRequestInterceptorInput
  ): Promise<ChatRequestInterceptorResult> {
    const messages = await this.injectMemories(input);

    return {
      messages,
      params: input.params,
    };
  }

  private async injectMemories(
    input: ChatRequestInterceptorInput
  ): Promise<PromptMessage[]> {
    if (!this.promptService) {
      return input.messages;
    }
    if (input.toolsConfig?.memory === false) {
      return input.messages;
    }

    const query = input.query?.trim();
    if (!query) {
      return input.messages;
    }

    try {
      return await this.promptService.injectMemoriesIntoMessages(
        input.messages,
        {
          workspaceId: input.workspaceId,
          userId: input.userId,
          query,
          topK: 5,
        }
      );
    } catch (err) {
      this.logger.warn(
        `Memory interceptor failed for session ${input.sessionId}: ${err instanceof Error ? err.message : String(err)}`
      );
      return input.messages;
    }
  }
}
