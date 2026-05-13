import { CopilotProviderSideError, metrics } from '../../../../base';
import {
  llmDispatchStream,
  type NativeLlmBackendConfig,
  type NativeLlmRequest,
} from '../../../../native';
import type { NodeTextMiddleware } from '../../config';
import type { CopilotToolSet } from '../../tools';
import { buildNativeRequest, NativeProviderAdapter } from '../native';
import { CopilotProvider } from '../provider';
import {
  CopilotChatOptions,
  CopilotProviderType,
  ModelConditions,
  ModelInputType,
  ModelOutputType,
  PromptMessage,
} from '../types';

export type XAIConfig = {
  apiKey: string;
  baseURL?: string;
};

/**
 * xAI Grok provider. Speaks the OpenAI chat-completions wire format hosted
 * at https://api.x.ai/v1.
 *
 * Self-hosted instances without a configured `apiKey` get a graceful
 * no-op (configured()=false) so registration cannot crash the server.
 *
 * NOTE: xAI iterates the model lineup frequently and retires older ids on
 * short notice (see https://docs.x.ai/docs/models). The registered list
 * below tracks the active lineup at the time of writing; stale ids will
 * simply 4xx at the vendor side without affecting other providers.
 */
export class XAIProvider extends CopilotProvider<XAIConfig> {
  readonly type = CopilotProviderType.XAI;

  readonly models = [
    {
      name: 'Grok 4',
      id: 'grok-4',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Grok 4 Fast Reasoning',
      id: 'grok-4-fast-reasoning',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Grok 4 Fast Non-Reasoning',
      id: 'grok-4-fast-non-reasoning',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Grok 4.1 Fast Reasoning',
      id: 'grok-4-1-fast-reasoning',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Grok 4.1 Fast Non-Reasoning',
      id: 'grok-4-1-fast-non-reasoning',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Grok Code Fast 1',
      id: 'grok-code-fast-1',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
  ];

  override configured(): boolean {
    return !!this.config.apiKey;
  }

  protected override setup() {
    super.setup();
  }

  private createNativeConfig(): NativeLlmBackendConfig {
    const baseUrl = this.config.baseURL || 'https://api.x.ai/v1';
    return {
      // xAI's OpenAI-compatible endpoint sits at /v1/chat/completions.
      // The native dispatcher appends /v1/chat/completions, so strip
      // the trailing `/v1` here.
      base_url: baseUrl.replace(/\/v1\/?$/, ''),
      auth_token: this.config.apiKey,
    };
  }

  private createNativeAdapter(
    tools: CopilotToolSet,
    nodeTextMiddleware?: NodeTextMiddleware[]
  ) {
    return new NativeProviderAdapter(
      (request: NativeLlmRequest, signal?: AbortSignal) =>
        llmDispatchStream(
          'openai_chat',
          this.createNativeConfig(),
          request,
          signal
        ),
      tools,
      this.MAX_STEPS,
      { nodeTextMiddleware }
    );
  }

  async text(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): Promise<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    const normalizedCond = await this.checkParams({
      cond: fullCond,
      messages,
      options,
    });
    const model = this.selectModel(normalizedCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, this.metricLabels(model.id));

      const tools = await this.getTools(options, model.id);
      const middleware = this.getActiveProviderMiddleware();
      const { request } = await buildNativeRequest({
        model: model.id,
        messages,
        options,
        tools,
        middleware,
      });
      const adapter = this.createNativeAdapter(tools, middleware.node?.text);
      return await adapter.text(request, options.signal, messages);
    } catch (e: any) {
      metrics.ai
        .counter('chat_text_errors')
        .add(1, this.metricLabels(model.id));
      throw this.handleError(e);
    }
  }

  async *streamText(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    const normalizedCond = await this.checkParams({
      cond: fullCond,
      messages,
      options,
    });
    const model = this.selectModel(normalizedCond);

    try {
      metrics.ai
        .counter('chat_text_stream_calls')
        .add(1, this.metricLabels(model.id));

      const tools = await this.getTools(options, model.id);
      const middleware = this.getActiveProviderMiddleware();
      const { request } = await buildNativeRequest({
        model: model.id,
        messages,
        options,
        tools,
        middleware,
      });
      const adapter = this.createNativeAdapter(tools, middleware.node?.text);
      for await (const chunk of adapter.streamText(
        request,
        options.signal,
        messages
      )) {
        yield chunk;
      }
    } catch (e: any) {
      metrics.ai
        .counter('chat_text_stream_errors')
        .add(1, this.metricLabels(model.id));
      throw this.handleError(e);
    }
  }

  private handleError(e: any) {
    if (e instanceof CopilotProviderSideError) {
      return e;
    }
    return new CopilotProviderSideError({
      provider: this.type,
      kind: 'unexpected_response',
      message: e?.message || 'Unexpected xAI response',
    });
  }
}
