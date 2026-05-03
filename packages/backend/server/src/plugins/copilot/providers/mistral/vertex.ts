import { CopilotProviderType, ModelInputType, ModelOutputType } from '../types';
import type { VertexProviderConfig } from '../utils';
import {
  type VertexMaasPublisher,
  VertexOpenAICompatProvider,
} from '../vertex-openai-base';

export type MistralVertexConfig = VertexProviderConfig;

/**
 * Mistral family on Google Cloud Vertex Model Garden (publisher: mistralai).
 * Uses the same OpenAI-compatible MaaS endpoint as Llama / DeepSeek.
 */
export class MistralVertexProvider extends VertexOpenAICompatProvider {
  override readonly type = CopilotProviderType.MistralVertex;
  protected readonly publisher: VertexMaasPublisher = 'mistralai';

  override readonly models = [
    {
      name: 'Mistral Large 2411',
      id: 'mistral-large-2411',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Codestral 2501',
      id: 'codestral-2501',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
  ];
}
