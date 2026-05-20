/**
 * `image_gen` — Vertex Imagen 3 text-to-image AI tool.
 *
 * Reuses the geminiVertex provider's existing GCP IAM auth path
 * (`getGoogleAuth(config, 'google')`) — no new API keys needed.
 * Persists the generated image into the workspace's CopilotStorage
 * bucket and returns a stable URL the chat panel can render inline.
 *
 * Spec: IMPLEMENTATION_PLAN.md §A1 P2 tools + M3 E3.2.
 *
 * CLAUDE.md scars honored:
 *  - Vertex URL prefix MUST include
 *    `/projects/{project}/locations/{location}/publishers/google`
 *    — has been broken twice (v1.7.3 + v1.9.2). We rebuild the
 *    Imagen `:predict` URL inline here, matching the
 *    GeminiVertexProvider#buildImagenUrl helper exactly.
 *  - Graceful degradation: any non-2xx response from Vertex returns
 *    a `toolError` rather than throwing — the AI loop continues
 *    with a "failed" hint instead of crashing the chat stream.
 *  - Cost passthrough: each successful call increments
 *    `metrics.ai.counter('image_gen_tool_calls')` so downstream
 *    dashboards stay accurate; structured log line lets the
 *    `MnCostService` ingest keep tracking even when the M4 emit
 *    bridge isn't wired into the tool execute path.
 *
 * Endpoint:
 *   POST https://{location}-aiplatform.googleapis.com/v1
 *        /projects/{project}/locations/{location}
 *        /publishers/google/models/{model}:predict
 *
 * Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
 */

import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';

// Narrow imports so the unit spec doesn't have to drag in
// `base/index.ts` (whose `helpers/crypto.ts` requires
// `@affine/server-native`). The barrel is fine in production where
// the native binary is present; the leaf path keeps tests hermetic.
//
// We inline the bearer-token resolution rather than depending on
// `getGoogleAuth` from `providers/utils.ts` — the helper there also
// imports `../../../base`, which would re-introduce the same
// transitive native dep. `getGoogleAuth` is a thin wrapper around
// `new GoogleAuth(...).getClient().getAccessToken()` plus a URL
// builder, and we only need the bearer (the URL we build ourselves
// since Imagen lives at `:predict`, not the publisher root).
import { Config } from '../../../base/config';
import { metrics } from '../../../base/metrics';
import type { CopilotStorage } from '../storage';
import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

// Structural type for the Vertex provider config we read. Mirrors
// `VertexProviderConfig` in `providers/utils.ts` but avoids a
// runtime import of that module (which barrels through `base`).
interface VertexProviderConfigLike {
  location?: string;
  project?: string;
  googleAuthOptions?: ConstructorParameters<typeof GoogleAuth>[0];
}

const logger = new Logger('ImageGenTool');

// Default to Imagen 3 Generate 002, mirroring the
// `defaultForOutputType: true` model in `gemini/vertex.ts`. Callers
// don't pick a model — the tool is intentionally opinionated.
const DEFAULT_IMAGEN_MODEL = 'imagen-3.0-generate-002';

// Vertex Imagen response schema. The publisher returns one or more
// predictions; each is a base64-encoded image plus a mimeType. The
// :predict endpoint is text-to-image only — no attachment input.
const ImagenPredictionSchema = z.object({
  predictions: z.array(
    z.object({
      bytesBase64Encoded: z.string().min(1),
      mimeType: z.string().default('image/png'),
    })
  ),
});

const AspectRatioSchema = z
  .enum(['1:1', '4:3', '3:4', '16:9', '9:16'])
  .default('1:1');

const ImageGenInputSchema = z.object({
  prompt: z
    .string()
    .min(1, 'prompt is required')
    .max(2000, 'prompt too long')
    .describe('Natural-language description of the image to generate.'),
  aspectRatio: AspectRatioSchema.optional().describe(
    'Image aspect ratio. Defaults to 1:1.'
  ),
  sampleCount: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe('How many images to generate (max 4). Defaults to 1.'),
});

type ImageGenInput = z.infer<typeof ImageGenInputSchema>;

interface ImageGenSuccess {
  images: { url: string; mimeType: string }[];
  model: string;
  aspectRatio: string;
}

/**
 * Build the Imagen `:predict` URL. Replicates the exact prefix shape
 * `GeminiVertexProvider#buildImagenUrl` uses. The two scars (v1.7.3
 * + v1.9.2) enforce that the URL include the
 * `/projects/.../locations/.../publishers/google` segment —
 * otherwise Vertex rejects with `RESOURCE_PROJECT_INVALID`.
 */
function buildImagenUrl(
  location: string | undefined,
  project: string | undefined,
  modelId: string
): string | undefined {
  if (!location || !project) return undefined;
  return (
    `https://${location}-aiplatform.googleapis.com/v1` +
    `/projects/${project}/locations/${location}` +
    `/publishers/google/models/${modelId}:predict`
  );
}

/**
 * Resolve a Vertex AI bearer token from the same `googleAuthOptions`
 * shape the GeminiVertex provider uses. Mirrors the call signature of
 * `getGoogleAuth(config, 'google')` in `providers/utils.ts` but keeps
 * the import surface narrow (importing the helper there would pull in
 * `base/index.ts` and break the unit-test load path on macOS where the
 * Linux-built `@affine/server-native` binary can't dlopen).
 */
async function resolveVertexBearerToken(
  options: VertexProviderConfigLike
): Promise<string | undefined> {
  if (!options.googleAuthOptions) return undefined;
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    ...options.googleAuthOptions,
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token ?? undefined;
}

/**
 * Build the bound image-gen handler. The first argument
 * (`options: CopilotChatOptions`) is `.bind`-ed at registration time
 * in `provider.ts` so the tool's runtime arguments stay clean —
 * exactly the pattern used by `buildDocContentGetter`,
 * `buildBlobContentGetter`, etc. in this directory.
 *
 * `config` provides the Vertex `project` + `location` +
 * `googleAuthOptions`. `storage` is the singleton CopilotStorage
 * (resolved via ModuleRef in provider.ts), used to persist the
 * decoded image bytes and return a stable URL.
 */
export const buildImageGenHandler = (
  config: Config,
  storage: CopilotStorage
) => {
  return async (
    options: CopilotChatOptions,
    input: ImageGenInput
  ): Promise<ImageGenSuccess | ReturnType<typeof toolError>> => {
    const userId = options?.user;
    const workspaceId = options?.workspace;

    if (!userId || !workspaceId) {
      return toolError(
        'Image Generation Failed',
        'Image generation requires a user + workspace context.'
      );
    }

    const vertexConfig = config.copilot.providers.geminiVertex;
    if (!vertexConfig?.location || !vertexConfig?.project) {
      return toolError(
        'Image Generation Failed',
        'Vertex AI is not configured (missing `project` or `location`).'
      );
    }

    const url = buildImagenUrl(
      vertexConfig.location,
      vertexConfig.project,
      DEFAULT_IMAGEN_MODEL
    );
    if (!url) {
      return toolError(
        'Image Generation Failed',
        'Failed to build Vertex Imagen request URL.'
      );
    }

    try {
      const bearer = await resolveVertexBearerToken(
        vertexConfig as VertexProviderConfigLike
      );

      const body = JSON.stringify({
        instances: [{ prompt: input.prompt }],
        parameters: {
          sampleCount: input.sampleCount ?? 1,
          aspectRatio: input.aspectRatio ?? '1:1',
          safetyFilterLevel: 'block_some',
          personGeneration: 'allow_adult',
        },
      });

      const response = await globalThis.fetch(url, {
        method: 'POST',
        headers: {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          'Content-Type': 'application/json',
        },
        body,
        signal: options?.signal,
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => '<unreadable response body>');
        metrics.ai
          .counter('image_gen_tool_errors')
          .add(1, { status: String(response.status) });
        logger.warn(
          `Vertex Imagen ${response.status} for workspace ${workspaceId}: ${errorText}`
        );
        return toolError(
          'Image Generation Failed',
          `Vertex Imagen returned ${response.status}.`
        );
      }

      const json: unknown = await response.json().catch(() => null);
      const parsed = ImagenPredictionSchema.safeParse(json);
      if (!parsed.success) {
        metrics.ai.counter('image_gen_tool_errors').add(1, {
          status: 'schema_mismatch',
        });
        logger.warn(
          `Unexpected Vertex Imagen response shape: ${parsed.error.message}`
        );
        return toolError(
          'Image Generation Failed',
          'Unexpected response shape from Vertex Imagen.'
        );
      }

      const predictions = parsed.data.predictions;
      if (!predictions.length) {
        return toolError(
          'Image Generation Failed',
          'Vertex Imagen returned no images for the prompt.'
        );
      }

      const urls: { url: string; mimeType: string }[] = [];
      for (const prediction of predictions) {
        const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
        // Content-addressed key matches the existing CopilotStorage
        // convention (see resolver.ts:911 + workspace/service.ts:67).
        const key = createHash('sha256').update(buffer).digest('base64url');
        const blobUrl = await storage.put(userId, workspaceId, key, buffer);
        urls.push({ url: blobUrl, mimeType: prediction.mimeType });
      }

      // Cost passthrough — structured log so the analytics pipeline
      // can attribute the call without needing M4's emit bridge to
      // be wired into the tool execute path.
      metrics.ai
        .counter('image_gen_tool_calls')
        .add(1, { model: DEFAULT_IMAGEN_MODEL });
      logger.log(
        `image_gen ok workspace=${workspaceId} user=${userId} ` +
          `model=${DEFAULT_IMAGEN_MODEL} count=${urls.length} ` +
          `aspect=${input.aspectRatio ?? '1:1'}`
      );

      return {
        images: urls,
        model: DEFAULT_IMAGEN_MODEL,
        aspectRatio: input.aspectRatio ?? '1:1',
      };
    } catch (e: unknown) {
      metrics.ai.counter('image_gen_tool_errors').add(1, {
        status: 'exception',
      });
      const message = e instanceof Error ? e.message : 'Unexpected error';
      logger.error(`image_gen failed workspace=${workspaceId}: ${message}`);
      return toolError('Image Generation Failed', message);
    }
  };
};

/**
 * Tool factory. The bound `handler` already has the chat session's
 * `user` + `workspace` baked in (via `.bind(null, options)` in
 * provider.ts), so the AI-facing input schema only takes the user's
 * prompt + optional formatting knobs.
 */
export const createImageGenTool = (
  handler: (input: ImageGenInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      'Generate a new image from a text prompt using Vertex Imagen 3. ' +
      'Returns one or more image URLs that the chat UI renders inline. ' +
      'Text-to-image only — does NOT support image editing.',
    inputSchema: ImageGenInputSchema,
    execute: async input => {
      try {
        const result = await handler(input);
        return result;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`image_gen tool execute failed: ${message}`);
        return toolError('Image Generation Failed', message);
      }
    },
  });
};
