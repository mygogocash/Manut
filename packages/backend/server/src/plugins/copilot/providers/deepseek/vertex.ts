import { CopilotProviderType, ModelInputType, ModelOutputType } from '../types';
import type { VertexProviderConfig } from '../utils';
import {
  type VertexMaasPublisher,
  VertexOpenAICompatProvider,
} from '../vertex-openai-base';

export type DeepSeekVertexConfig = VertexProviderConfig;

/**
 * DeepSeek family on Google Cloud Vertex Model Garden
 * (publisher: deepseek-ai). OpenAI-compatible chat-completions.
 */
export class DeepSeekVertexProvider extends VertexOpenAICompatProvider {
  override readonly type = CopilotProviderType.DeepSeekVertex;
  protected readonly publisher: VertexMaasPublisher = 'deepseek-ai';

  override readonly models = [
    {
      name: 'DeepSeek R1 0528',
      id: 'deepseek-r1-0528-maas',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
  ];
}
