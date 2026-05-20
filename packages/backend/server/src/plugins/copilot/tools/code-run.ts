/**
 * `code_run` — Modal sandbox AI tool. Runs a short snippet of
 * Python / JavaScript / TypeScript / Bash inside a remote Modal
 * sandbox and returns `{stdout, stderr, exitCode, durationMs}`.
 *
 * Spec: IMPLEMENTATION_PLAN.md §A1 P2 tools + M3 E3.1.
 *
 * Auth contract:
 *   - Reads `MODAL_API_TOKEN` (and optional `MODAL_API_ENDPOINT`)
 *     via the typed Config service (`config.copilot.modal`).
 *   - When the token is empty (the common self-host shape — Modal is
 *     opt-in infrastructure, not bundled), the tool returns a
 *     `toolError` with friendly copy. Same graceful-degradation
 *     pattern as `exa-search.ts`, `gmail.ts`, and `image-gen.ts`.
 *
 * Endpoint:
 *   Modal does NOT expose a public REST endpoint for arbitrary
 *   sandbox invocation — sandboxes are spawned via the Modal Python
 *   SDK (`modal.Sandbox.create`). The intended deployment shape is
 *   an operator-deployed `@modal.web_endpoint` Python function that
 *   forwards `{language, code, timeout_ms}` into a sandbox and
 *   returns the result. Default endpoint constant below is a
 *   placeholder reflecting that shape — operators override via
 *   `MODAL_API_ENDPOINT` once their wrapper is deployed.
 *
 *   Body shape (matches the deployed wrapper):
 *     POST <endpoint>
 *     Headers: Authorization: Bearer <token>; Content-Type: application/json
 *     Body:    { language, code, timeout_ms }
 *     Returns: { stdout, stderr, exit_code, duration_ms }
 *
 * CLAUDE.md scars honored:
 *   - Never throws: every failure mode returns a `toolError` so the
 *     chat stream stays alive.
 *   - Cost passthrough: each invocation increments
 *     `metrics.ai.counter('code_run_tool_calls')` + a structured log
 *     line carrying language + duration so the M4 cost bridge can
 *     attribute usage without needing emit wiring.
 *   - No hardcoded secrets — the token flows through Config only.
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';

// Narrow imports: skip `../../../base` (which transitively requires
// `@affine/server-native`) and pull only the leaf config type. Same
// pattern image-gen.ts uses to keep specs hermetic on macOS.
import { Config } from '../../../base/config';
import { metrics } from '../../../base/metrics';
import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const logger = new Logger('CodeRunTool');

// Default endpoint placeholder. Operators deploy a Modal
// `@modal.web_endpoint`-decorated function that wraps
// `modal.Sandbox.create(...).run(...)` and override this via the
// `copilot.modal.endpoint` config value. The default URL intentionally
// will NOT resolve — the graceful "Modal not configured" path covers
// installs that haven't deployed the wrapper.
const DEFAULT_MODAL_ENDPOINT = 'https://api.modal.com/v1/sandbox/run';

const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'bash',
] as const;

const CodeRunInputSchema = z.object({
  code: z
    .string()
    .min(1, 'code is required')
    .describe('The source code to run inside the Modal sandbox.'),
  language: z
    .enum(SUPPORTED_LANGUAGES)
    .default('python')
    .describe(
      'Programming language for the snippet. One of python, javascript, typescript, bash.'
    ),
  timeoutMs: z
    .number()
    .int()
    .min(1)
    .max(60000)
    .default(10000)
    .describe('Sandbox run timeout in milliseconds (max 60000).'),
});

type CodeRunInput = z.infer<typeof CodeRunInputSchema>;

interface CodeRunSuccess {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

// Response from the deployed Modal wrapper. We use a permissive
// `safeParse` because operator wrappers may shift field names slightly.
const ModalResponseSchema = z.object({
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  exit_code: z.number().int().default(0),
  duration_ms: z.number().nonnegative().optional(),
});

// Structural type for the Modal config we read. Mirrors what
// `defineModuleConfig('copilot.modal', ...)` shapes the Config service
// to, but kept narrow so the unit spec doesn't need a real Config.
interface ModalConfigLike {
  apiToken?: string;
  endpoint?: string;
}

interface CopilotConfigLike {
  copilot?: {
    modal?: ModalConfigLike;
  };
}

/**
 * Build the bound code-run handler. The first argument
 * (`options: CopilotChatOptions`) is `.bind`-ed at registration time
 * in `provider.ts` — same pattern as `buildImageGenHandler`,
 * `buildGmailSearchHandler`, etc.
 */
export const buildCodeRunHandler = (config: Config) => {
  return async (
    options: CopilotChatOptions,
    input: CodeRunInput
  ): Promise<CodeRunSuccess | ReturnType<typeof toolError>> => {
    const workspaceId = options?.workspace;
    const userId = options?.user;

    // Read Modal config via a typed-but-narrow projection so the spec
    // can pass a duck-typed object without needing the real Config DI.
    const modalConfig = (config as unknown as CopilotConfigLike).copilot?.modal;
    const modalToken = modalConfig?.apiToken?.trim();
    const modalEndpoint =
      modalConfig?.endpoint?.trim() || DEFAULT_MODAL_ENDPOINT;

    if (!modalToken) {
      // Graceful no-op: same shape as exa-search when the API key
      // isn't configured. The AI loop sees a structured error and
      // can adjust its plan rather than crashing the chat stream.
      return toolError(
        'Code Execution Failed',
        'Code execution not configured. Set MODAL_API_TOKEN.'
      );
    }

    const startedAt = Date.now();
    try {
      const body = JSON.stringify({
        language: input.language,
        code: input.code,
        timeout_ms: input.timeoutMs,
      });

      const response = await globalThis.fetch(modalEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${modalToken}`,
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
          .counter('code_run_tool_errors')
          .add(1, { status: String(response.status) });
        logger.warn(
          `Modal sandbox ${response.status} for workspace ${workspaceId ?? '<none>'}: ${errorText.slice(0, 200)}`
        );
        return toolError(
          'Code Execution Failed',
          `Modal sandbox returned ${response.status}.`
        );
      }

      const json: unknown = await response.json().catch(() => null);
      const parsed = ModalResponseSchema.safeParse(json);
      if (!parsed.success) {
        metrics.ai.counter('code_run_tool_errors').add(1, {
          status: 'schema_mismatch',
        });
        logger.warn(
          `Unexpected Modal sandbox response shape: ${parsed.error.message}`
        );
        return toolError(
          'Code Execution Failed',
          'Unexpected response shape from Modal sandbox.'
        );
      }

      const durationMs = parsed.data.duration_ms ?? Date.now() - startedAt;

      // Cost passthrough — structured log so the analytics pipeline
      // can attribute the call without needing the M4 emit bridge
      // to be wired into every tool execute path.
      metrics.ai
        .counter('code_run_tool_calls')
        .add(1, { language: input.language });
      logger.log(
        `code_run ok workspace=${workspaceId ?? '<none>'} user=${userId ?? '<none>'} ` +
          `language=${input.language} exit_code=${parsed.data.exit_code} duration_ms=${durationMs}`
      );

      return {
        stdout: parsed.data.stdout,
        stderr: parsed.data.stderr,
        exitCode: parsed.data.exit_code,
        durationMs,
      };
    } catch (e: unknown) {
      metrics.ai
        .counter('code_run_tool_errors')
        .add(1, { status: 'exception' });
      const message = e instanceof Error ? e.message : 'Unexpected error';
      // AbortError (timeout / signal-cancel) maps to a friendly hint —
      // anything else returns the raw message to aid debugging.
      const isAbort =
        e instanceof Error &&
        (e.name === 'AbortError' || /aborted|timeout/i.test(message));
      logger.error(
        `code_run failed workspace=${workspaceId ?? '<none>'}: ${message}`
      );
      return toolError(
        'Code Execution Failed',
        isAbort
          ? 'Code execution timed out before Modal could respond.'
          : message
      );
    }
  };
};

/**
 * Tool factory. The bound `handler` already has the chat session's
 * `user` + `workspace` baked in (via `.bind(null, options)` in
 * provider.ts), so the AI-facing input schema only carries the
 * snippet + language + timeout knob.
 */
export const createCodeRunTool = (
  handler: (input: CodeRunInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      'Run a short snippet of code (Python / JavaScript / TypeScript / Bash) in a ' +
      'remote Modal sandbox and return the captured stdout, stderr, exit code, and ' +
      'wall-clock duration. Use for one-shot computations, data wrangling, or quick ' +
      'verification of an idea. The sandbox is ephemeral — nothing persists between calls.',
    inputSchema: CodeRunInputSchema,
    execute: async input => {
      try {
        return await handler(input);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`code_run tool execute failed: ${message}`);
        return toolError('Code Execution Failed', message);
      }
    },
  });
};
