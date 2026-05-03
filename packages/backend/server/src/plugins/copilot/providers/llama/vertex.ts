import { CopilotProviderType, ModelInputType, ModelOutputType } from '../types';
import type { VertexProviderConfig } from '../utils';
import {
  type VertexMaasPublisher,
  VertexOpenAICompatProvider,
} from '../vertex-openai-base';

export type LlamaVertexConfig = VertexProviderConfig;

/**
 * Llama family on Google Cloud Vertex Model Garden (publisher: meta).
 * Speaks the OpenAI-compatible chat-completions wire format hosted at
 *   https://{location}-aiplatform.googleapis.com/v1beta1/projects/{project}/locations/{location}/endpoints/openapi/chat/completions
 *
 * Auth uses the service-account flow shared with the Gemini / Anthropic
 * Vertex providers, so no separate API key is needed.
 */
export class LlamaVertexProvider extends VertexOpenAICompatProvider {
  override readonly type = CopilotProviderType.LlamaVertex;
  protected readonly publisher: VertexMaasPublisher = 'meta';

  override readonly models = [
    {
      name: 'Llama 3.1 70B Instruct',
      id: 'llama-3.1-70b-instruct-maas',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Llama 3.1 405B Instruct',
      id: 'llama-3.1-405b-instruct-maas',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Llama 4 Scout 17B',
      id: 'llama-4-scout-17b-16e-instruct-maas',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
    {
      name: 'Llama 4 Maverick 17B',
      id: 'llama-4-maverick-17b-128e-instruct-maas',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Object],
        },
      ],
    },
  ];
}
