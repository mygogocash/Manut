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

export type MoonshotConfig = {
  apiKey: string;
  baseURL?: string;
};

/**
 * Moonshot AI (Kimi) provider. Speaks the OpenAI chat-completions wire
 * format hosted at https://api.moonshot.ai/v1.
 *
 * Self-hosted instances without a configured `apiKey` get a graceful
 * no-op (configured()=false) so registration cannot crash the server.
 */
export class MoonshotProvider extends CopilotProvider<MoonshotConfig> {
  readonly type = CopilotProviderType.Moonshot;

  readonly models = [
    {
      name: 'Kimi K2 Thinking',
      id: 'kimi-k2-thinking',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Kimi K2 Thinking Turbo',
      id: 'kimi-k2-thinking-turbo',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Kimi K2 0905 Preview',
      id: 'kimi-k2-0905-preview',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Kimi K2 Turbo Preview',
      id: 'kimi-k2-turbo-preview',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Moonshot v1 128k',
      id: 'moonshot-v1-128k',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Moonshot v1 Auto',
      id: 'moonshot-v1-auto',
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
    const baseUrl = this.config.baseURL || 'https://api.moonshot.ai/v1';
    return {
      // Moonshot exposes the OpenAI v1 chat-completions wire format at
      // https://api.moonshot.ai/v1/chat/completions. The native dispatcher
      // appends `/v1/chat/completions` itself, so strip the trailing `/v1`.
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
      message: e?.message || 'Unexpected moonshot response',
    });
  }
}
