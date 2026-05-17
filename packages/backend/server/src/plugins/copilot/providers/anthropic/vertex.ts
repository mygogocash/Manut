import { emitProviderCostEvent } from '../../cost-emit';
import { IMAGE_ATTACHMENT_CAPABILITY } from '../attachments';
import type {
  CopilotChatOptions,
  ModelConditions,
  PromptMessage,
  StreamObject,
} from '../types';
import { CopilotProviderType, ModelInputType, ModelOutputType } from '../types';
import {
  getGoogleAuth,
  getVertexAnthropicBaseUrl,
  VertexModelListSchema,
  type VertexProviderConfig,
} from '../utils';
import { AnthropicProvider } from './anthropic';

export type AnthropicVertexConfig = VertexProviderConfig;

export class AnthropicVertexProvider extends AnthropicProvider<AnthropicVertexConfig> {
  override readonly type = CopilotProviderType.AnthropicVertex;

  override readonly models = [
    // Latest Claude on Vertex (versionId='default' on the publisher API,
    // so no `@<date>` suffix — matches the refreshOnlineModels logic below).
    {
      name: 'Claude Opus 4.7',
      id: 'claude-opus-4-7',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          attachments: IMAGE_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Claude Opus 4.6',
      id: 'claude-opus-4-6',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          attachments: IMAGE_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Claude Sonnet 4.6',
      id: 'claude-sonnet-4-6',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          attachments: IMAGE_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Claude Opus 4.1',
      id: 'claude-opus-4-1@20250805',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          attachments: IMAGE_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Claude Opus 4',
      id: 'claude-opus-4@20250514',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          attachments: IMAGE_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Claude Sonnet 4.5',
      id: 'claude-sonnet-4-5@20250929',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          attachments: IMAGE_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Claude Sonnet 4',
      id: 'claude-sonnet-4@20250514',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text, ModelOutputType.Object],
          attachments: IMAGE_ATTACHMENT_CAPABILITY,
        },
      ],
    },
  ];

  override configured(): boolean {
    if (!this.config.location || !this.config.googleAuthOptions) return false;
    return !!this.config.project || !!getVertexAnthropicBaseUrl(this.config);
  }

  /**
   * M4 cost-emit wrapper. Delegates to the AnthropicProvider base, then
   * fires a cost row via `MnCostService.emit` on stream close
   * (fire-and-forget per CLAUDE.md scar #5).
   */
  override async *streamText(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<string> {
    const model = this.selectModel({
      ...cond,
      outputType: ModelOutputType.Text,
    });
    let collected = '';
    for await (const chunk of super.streamText(cond, messages, options)) {
      collected += chunk;
      yield chunk;
    }
    emitProviderCostEvent(this.moduleRef, this.logger, {
      provider: this.type,
      model: model.id,
      messages,
      outputText: collected,
      options,
    });
  }

  override async *streamObject(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<StreamObject> {
    const model = this.selectModel({
      ...cond,
      outputType: ModelOutputType.Object,
    });
    let outputChars = 0;
    for await (const chunk of super.streamObject(cond, messages, options)) {
      if (chunk.type === 'text-delta' && chunk.textDelta) {
        outputChars += chunk.textDelta.length;
      }
      yield chunk;
    }
    emitProviderCostEvent(this.moduleRef, this.logger, {
      provider: this.type,
      model: model.id,
      messages,
      outputTextLength: outputChars,
      options,
    });
  }

  override async refreshOnlineModels() {
    try {
      const { baseUrl, headers } = await getGoogleAuth(
        this.config,
        'anthropic'
      );
      if (baseUrl && !this.onlineModelList.length) {
        const { publisherModels } = await fetch(`${baseUrl}/models`, {
          headers: headers(),
        })
          .then(r => r.json())
          .then(r => VertexModelListSchema.parse(r));
        this.onlineModelList = publisherModels.map(
          model =>
            model.name.replace('publishers/anthropic/models/', '') +
            (model.versionId !== 'default' ? `@${model.versionId}` : '')
        );
      }
    } catch (e) {
      this.logger.error('Failed to fetch available models', e);
    }
  }
}
