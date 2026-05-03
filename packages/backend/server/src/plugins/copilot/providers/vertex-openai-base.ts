import {
  CopilotProviderSideError,
  metrics,
  UserFriendlyError,
} from '../../../base';
import {
  llmDispatchStream,
  type NativeLlmBackendConfig,
  type NativeLlmRequest,
} from '../../../native';
import type { NodeTextMiddleware } from '../config';
import type { CopilotTool, CopilotToolSet } from '../tools';
import { buildNativeRequest, NativeProviderAdapter } from './native';
import { CopilotProvider } from './provider';
import type {
  CopilotChatOptions,
  CopilotChatTools,
  ModelConditions,
  PromptMessage,
  StreamObject,
} from './types';
import { ModelOutputType } from './types';
import {
  getGoogleAuth,
  getVertexOpenAIBaseUrl,
  type VertexProviderConfig,
} from './utils';

/**
 * Vertex Model Garden publishers that expose an OpenAI-compatible
 * `/chat/completions` endpoint via the MaaS `endpoints/openapi` route.
 */
export type VertexMaasPublisher = 'meta' | 'mistralai' | 'deepseek-ai';

/**
 * Abstract base class for Vertex Model Garden providers that speak the
 * OpenAI chat-completions wire format. Concrete subclasses (Llama, Mistral,
 * DeepSeek) only need to declare their model list, type, and publisher slug.
 *
 * Auth piggybacks on the existing service-account flow used by Gemini and
 * Anthropic Vertex providers. The bearer token is fetched per request via
 * `getGoogleAuth` so token refresh is handled by `google-auth-library`.
 */
export abstract class VertexOpenAICompatProvider extends CopilotProvider<VertexProviderConfig> {
  /**
   * Vertex publisher slug used as the model-name prefix in chat requests
   * (e.g. `meta/llama-3.1-70b-instruct-maas`). Subclasses must override.
   */
  protected abstract readonly publisher: VertexMaasPublisher;

  override configured(): boolean {
    return (
      !!this.config.location &&
      !!this.config.project &&
      !!this.config.googleAuthOptions
    );
  }

  override async refreshOnlineModels() {
    // Listing publisher MaaS models requires a per-publisher endpoint that
    // is not strictly necessary for our usage — we ship a static catalogue
    // and let the model registry route requests directly. Override per
    // subclass if dynamic discovery becomes desirable.
  }

  override getProviderSpecificTools(
    toolName: CopilotChatTools,
    _model: string
  ): [string, CopilotTool?] | undefined {
    if (toolName === 'docEdit') {
      return ['doc_edit', undefined];
    }
    return;
  }

  protected handleError(e: any) {
    if (e instanceof UserFriendlyError) {
      return e;
    }
    return new CopilotProviderSideError({
      provider: this.type,
      kind: 'unexpected_response',
      message: e?.message || 'Unexpected vertex MaaS response',
    });
  }

  /**
   * Prefix a bare model id with the Vertex publisher slug if it is not
   * already prefixed. Vertex MaaS expects e.g. `meta/llama-3.1-70b-instruct-maas`
   * in the OpenAI-compatible request body.
   */
  protected qualifyModel(modelId: string) {
    if (modelId.includes('/')) return modelId;
    return `${this.publisher}/${modelId}`;
  }

  protected async createNativeConfig(): Promise<NativeLlmBackendConfig> {
    const auth = await getGoogleAuth(this.config, this.publisher);
    const baseUrl = getVertexOpenAIBaseUrl(this.config) || auth.baseUrl;
    if (!baseUrl) {
      throw new Error(
        `Vertex MaaS provider ${this.type} requires location + project to be configured`
      );
    }
    const { Authorization: authHeader } = auth.headers();
    return {
      base_url: baseUrl.replace(/\/$/, ''),
      auth_token: authHeader.replace(/^Bearer\s+/i, ''),
      request_layer: 'chat_completions',
    };
  }

  private createNativeAdapter(
    backendConfig: NativeLlmBackendConfig,
    tools: CopilotToolSet,
    nodeTextMiddleware?: NodeTextMiddleware[]
  ) {
    return new NativeProviderAdapter(
      (request: NativeLlmRequest, signal?: AbortSignal) =>
        llmDispatchStream('openai_chat', backendConfig, request, signal),
      tools,
      this.MAX_STEPS,
      { nodeTextMiddleware }
    );
  }

  override async text(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): Promise<string> {
    const normalizedCond = await this.checkParams({
      messages,
      cond: { ...cond, outputType: ModelOutputType.Text },
      options,
    });
    const model = this.selectModel(normalizedCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, this.metricLabels(model.id));
      const backendConfig = await this.createNativeConfig();
      const tools = await this.getTools(options, model.id);
      const middleware = this.getActiveProviderMiddleware();
      const { request } = await buildNativeRequest({
        model: this.qualifyModel(model.id),
        messages,
        options,
        tools,
        middleware,
      });
      return await this.createNativeAdapter(
        backendConfig,
        tools,
        middleware.node?.text
      ).text(request, options.signal, messages);
    } catch (e: any) {
      metrics.ai
        .counter('chat_text_errors')
        .add(1, this.metricLabels(model.id));
      throw this.handleError(e);
    }
  }

  override async *streamText(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<string> {
    const normalizedCond = await this.checkParams({
      messages,
      cond: { ...cond, outputType: ModelOutputType.Text },
      options,
    });
    const model = this.selectModel(normalizedCond);

    try {
      metrics.ai
        .counter('chat_text_stream_calls')
        .add(1, this.metricLabels(model.id));
      const backendConfig = await this.createNativeConfig();
      const tools = await this.getTools(options, model.id);
      const middleware = this.getActiveProviderMiddleware();
      const { request } = await buildNativeRequest({
        model: this.qualifyModel(model.id),
        messages,
        options,
        tools,
        middleware,
      });
      for await (const chunk of this.createNativeAdapter(
        backendConfig,
        tools,
        middleware.node?.text
      ).streamText(request, options.signal, messages)) {
        yield chunk;
      }
    } catch (e: any) {
      metrics.ai
        .counter('chat_text_stream_errors')
        .add(1, this.metricLabels(model.id));
      throw this.handleError(e);
    }
  }

  override async *streamObject(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<StreamObject> {
    const normalizedCond = await this.checkParams({
      messages,
      cond: { ...cond, outputType: ModelOutputType.Object },
      options,
    });
    const model = this.selectModel(normalizedCond);

    try {
      metrics.ai
        .counter('chat_object_stream_calls')
        .add(1, this.metricLabels(model.id));
      const backendConfig = await this.createNativeConfig();
      const tools = await this.getTools(options, model.id);
      const middleware = this.getActiveProviderMiddleware();
      const { request } = await buildNativeRequest({
        model: this.qualifyModel(model.id),
        messages,
        options,
        tools,
        middleware,
      });
      for await (const chunk of this.createNativeAdapter(
        backendConfig,
        tools,
        middleware.node?.text
      ).streamObject(request, options.signal, messages)) {
        yield chunk;
      }
    } catch (e: any) {
      metrics.ai
        .counter('chat_object_stream_errors')
        .add(1, this.metricLabels(model.id));
      throw this.handleError(e);
    }
  }
}
