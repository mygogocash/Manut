/**
 * GeminiVertexProvider — Gemini chat models + Vertex AI Imagen for image gen.
 *
 * Imagen is text-to-image only and uses a different REST endpoint shape from
 * Gemini. We call it directly via fetch with the same Bearer token already
 * resolved by `getGoogleAuth`, so no new dependencies are needed.
 *
 * Endpoint:
 *   POST https://{location}-aiplatform.googleapis.com/v1/projects/{project}/
 *        locations/{location}/publishers/google/models/{model}:predict
 *
 * Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
 */

import { z } from 'zod';

import {
  CopilotPromptInvalid,
  CopilotProviderSideError,
  metrics,
  UserFriendlyError,
} from '../../../../base';
import type { NativeLlmBackendConfig } from '../../../../native';
import { GEMINI_ATTACHMENT_CAPABILITY } from '../attachments';
import type {
  CopilotImageOptions,
  ModelConditions,
  PromptMessage,
} from '../types';
import { CopilotProviderType, ModelInputType, ModelOutputType } from '../types';
import {
  getGoogleAuth,
  VertexModelListSchema,
  type VertexProviderConfig,
} from '../utils';
import { GeminiProvider } from './gemini';

export type GeminiVertexConfig = VertexProviderConfig;

const ImagenPredictionSchema = z.object({
  predictions: z.array(
    z.object({
      bytesBase64Encoded: z.string(),
      mimeType: z.string().default('image/png'),
    })
  ),
});

export class GeminiVertexProvider extends GeminiProvider<GeminiVertexConfig> {
  override readonly type = CopilotProviderType.GeminiVertex;

  readonly models = [
    {
      name: 'Gemini 2.5 Flash',
      id: 'gemini-2.5-flash',
      capabilities: [
        {
          input: [
            ModelInputType.Text,
            ModelInputType.Image,
            ModelInputType.Audio,
            ModelInputType.File,
          ],
          output: [
            ModelOutputType.Text,
            ModelOutputType.Object,
            ModelOutputType.Structured,
          ],
          attachments: GEMINI_ATTACHMENT_CAPABILITY,
          structuredAttachments: GEMINI_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Gemini 2.5 Pro',
      id: 'gemini-2.5-pro',
      capabilities: [
        {
          input: [
            ModelInputType.Text,
            ModelInputType.Image,
            ModelInputType.Audio,
            ModelInputType.File,
          ],
          output: [
            ModelOutputType.Text,
            ModelOutputType.Object,
            ModelOutputType.Structured,
          ],
          attachments: GEMINI_ATTACHMENT_CAPABILITY,
          structuredAttachments: GEMINI_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Gemini 3.1 Pro Preview',
      id: 'gemini-3.1-pro-preview',
      capabilities: [
        {
          input: [
            ModelInputType.Text,
            ModelInputType.Image,
            ModelInputType.Audio,
            ModelInputType.File,
          ],
          output: [
            ModelOutputType.Text,
            ModelOutputType.Object,
            ModelOutputType.Structured,
          ],
          attachments: GEMINI_ATTACHMENT_CAPABILITY,
          structuredAttachments: GEMINI_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Gemini 3.1 Flash Lite Preview',
      id: 'gemini-3.1-flash-lite-preview',
      capabilities: [
        {
          input: [
            ModelInputType.Text,
            ModelInputType.Image,
            ModelInputType.Audio,
            ModelInputType.File,
          ],
          output: [
            ModelOutputType.Text,
            ModelOutputType.Object,
            ModelOutputType.Structured,
          ],
          attachments: GEMINI_ATTACHMENT_CAPABILITY,
          structuredAttachments: GEMINI_ATTACHMENT_CAPABILITY,
        },
      ],
    },
    {
      name: 'Gemini Embedding',
      id: 'gemini-embedding-001',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Embedding],
          defaultForOutputType: true,
        },
      ],
    },
    // Vertex AI Imagen models. Text-to-image only — image attachments are
    // ignored (the :predict endpoint has no image-edit input). Lets the
    // copilot's `image` scenario work without any OpenAI / Fal API key by
    // reusing the geminiVertex provider's existing GCP IAM auth.
    {
      name: 'Imagen 3 Generate',
      id: 'imagen-3.0-generate-002',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Image],
          defaultForOutputType: true,
        },
      ],
    },
    {
      name: 'Imagen 3 Fast Generate',
      id: 'imagen-3.0-fast-generate-001',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Image],
        },
      ],
    },
  ];

  override configured(): boolean {
    return !!this.config.location && !!this.config.googleAuthOptions;
  }

  override async refreshOnlineModels() {
    try {
      const { baseUrl, headers } = await this.resolveVertexAuth();
      if (baseUrl && !this.onlineModelList.length) {
        const { publisherModels } = await fetch(`${baseUrl}/models`, {
          headers: headers(),
        })
          .then(r => r.json())
          .then(r => VertexModelListSchema.parse(r));
        this.onlineModelList = publisherModels.map(model =>
          model.name.replace('publishers/google/models/', '')
        );
      }
    } catch (e) {
      this.logger.error('Failed to fetch available models', e);
    }
  }

  protected async resolveVertexAuth() {
    return await getGoogleAuth(this.config, 'google');
  }

  protected override async createNativeConfig(): Promise<NativeLlmBackendConfig> {
    const auth = await this.resolveVertexAuth();
    const { Authorization: authHeader } = auth.headers();

    return {
      base_url: auth.baseUrl || '',
      auth_token: authHeader.replace(/^Bearer\s+/i, ''),
      request_layer: 'gemini_vertex',
    };
  }

  /**
   * Build the Imagen `:predict` endpoint URL from the provider's location +
   * project. Throws if either is missing — these are required for any
   * geminiVertex deployment but `configured()` only checks `location`, so we
   * guard explicitly here.
   */
  private buildImagenUrl(modelId: string): string {
    const { location, project } = this.config;
    if (!location || !project) {
      throw new CopilotPromptInvalid(
        'GeminiVertex provider requires both `location` and `project` to use Imagen'
      );
    }
    return (
      `https://${location}-aiplatform.googleapis.com/v1` +
      `/projects/${project}/locations/${location}` +
      `/publishers/google/models/${modelId}:predict`
    );
  }

  /**
   * Generate images via Vertex AI Imagen.
   *
   * Imagen 3 is text-to-image only via the :predict endpoint, so style
   * conversion / upscale prompts work because their text prompt fully
   * describes the transformation — the source image attachment isn't
   * forwarded. If you need image-edit capability, swap to a model that
   * exposes editing through Vertex's separate /edit endpoint.
   */
  override async *streamImages(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotImageOptions = {}
  ): AsyncIterable<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Image };
    const normalizedCond = await this.checkParams({
      messages,
      cond: fullCond,
      options,
      withAttachment: false,
    });
    const model = this.selectModel(normalizedCond);

    metrics.ai
      .counter('generate_images_stream_calls')
      .add(1, this.metricLabels(model.id));

    const lastMessage = [...messages].pop();
    const prompt = lastMessage?.content?.trim();
    if (!prompt) {
      throw new CopilotPromptInvalid('Prompt is required for image generation');
    }

    try {
      const { headers } = await this.resolveVertexAuth();
      const url = this.buildImagenUrl(model.id);

      const body = JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
        },
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers(),
          'Content-Type': 'application/json',
        },
        body,
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '<unreadable>');
        throw new CopilotProviderSideError({
          provider: this.type,
          kind: 'unexpected_response',
          message: `Imagen API error ${response.status}: ${errorText}`,
        });
      }

      const json = await response.json();
      const parsed = ImagenPredictionSchema.safeParse(json);
      if (!parsed.success) {
        throw new CopilotProviderSideError({
          provider: this.type,
          kind: 'unexpected_response',
          message: `Unexpected Imagen response shape: ${parsed.error.message}`,
        });
      }

      const predictions = parsed.data.predictions;
      if (!predictions.length) {
        throw new CopilotProviderSideError({
          provider: this.type,
          kind: 'unexpected_response',
          message: 'No images returned from Imagen',
        });
      }

      for (const prediction of predictions) {
        if (options.signal?.aborted) break;
        yield `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`;
      }
    } catch (e: any) {
      metrics.ai
        .counter('generate_images_errors')
        .add(1, this.metricLabels(model.id));

      if (e instanceof UserFriendlyError) throw e;
      throw new CopilotProviderSideError({
        provider: this.type,
        kind: 'unexpected_response',
        message: e?.message || 'Unexpected Imagen response',
      });
    }
  }
}
