import { Injectable, Logger } from '@nestjs/common';
import { MnAgentAdapterType } from '@prisma/client';

import type {
  MnAdapter,
  MnAdapterInvokeInput,
  MnAdapterResult,
} from './manut-adapter.interface';
import { scrubSecrets } from './manut-adapter.interface';

/** Config field names whose VALUES must never be logged in plaintext. */
const SECRET_KEYS = ['apiKey'] as const;

/** Shape of `adapterConfig` for an E2B_SANDBOX adapter. */
export interface E2bAdapterConfig {
  /** E2B API key. SCRUBBED in all log lines. */
  apiKey: string;
  /** Sandbox template id (e.g. `python-data-science`). */
  templateId: string;
  /** Shell command to execute inside the sandbox. */
  command: string;
  /** Optional per-invocation timeout in milliseconds. Defaults to 300s. */
  timeoutMs?: number;
}

/**
 * M8 — E2B sandbox adapter.
 *
 * Wraps the `@e2b/code-interpreter` SDK to spin up a code sandbox,
 * run a configured command, and capture stdout/stderr/exit. The SDK
 * is loaded lazily via dynamic import so the backend can boot even
 * when the SDK isn't installed in the target environment (e.g. the
 * default Manut self-host image, where E2B isn't a default
 * integration). When the SDK is absent we return a structured "not
 * wired" warning rather than a thrown exception.
 *
 * Wire-up path:
 *
 *  1. Add `"@e2b/code-interpreter": "*"` to
 *     `packages/backend/server/package.json` dependencies.
 *  2. Set `E2B_API_KEY` (or per-agent `apiKey` in `adapterConfig`).
 *  3. Redeploy.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` decorator so the class can be registered as a
 *    NestJS provider (v1.12.0 DI scar).
 *  - `apiKey` is in `SECRET_KEYS`. The logger only ever logs the
 *    scrubbed config.
 *  - All transport errors are wrapped in the `MnAdapterResult`
 *    envelope, never thrown.
 */
@Injectable()
export class MnE2bAdapter implements MnAdapter {
  readonly adapterType: MnAgentAdapterType = MnAgentAdapterType.E2B_SANDBOX;

  private readonly logger = new Logger(MnE2bAdapter.name);

  validateConfig(adapterConfig: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    const apiKey = adapterConfig.apiKey;
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      errors.push('apiKey is required and must be a non-empty string');
    }

    const templateId = adapterConfig.templateId;
    if (typeof templateId !== 'string' || templateId.length === 0) {
      errors.push('templateId is required and must be a non-empty string');
    }

    const command = adapterConfig.command;
    if (typeof command !== 'string' || command.length === 0) {
      errors.push('command is required and must be a non-empty string');
    }

    const timeout = adapterConfig.timeoutMs;
    if (
      timeout !== undefined &&
      timeout !== null &&
      (typeof timeout !== 'number' || timeout <= 0 || timeout > 1_800_000)
    ) {
      errors.push('timeoutMs must be a positive number ≤ 1800000');
    }

    return { valid: errors.length === 0, errors };
  }

  async invoke(input: MnAdapterInvokeInput): Promise<MnAdapterResult> {
    const validation = this.validateConfig(input.adapterConfig);
    if (!validation.valid) {
      return {
        ok: false,
        error: `invalid adapter config: ${validation.errors.join('; ')}`,
        durationMs: 0,
      };
    }

    const config = input.adapterConfig as unknown as E2bAdapterConfig;
    const start = performance.now();

    // Lazy-load the SDK. If it's not installed, this throws
    // ERR_MODULE_NOT_FOUND — we catch and report a clean "not wired"
    // result. Production usage requires installing @e2b/code-interpreter
    // first.
    let sdk: unknown;
    try {
      sdk = await this.loadSdk();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `e2b SDK not loaded for agent=${input.agentId}: ${message}. ` +
          `Install @e2b/code-interpreter to enable this adapter. ` +
          `config=${JSON.stringify(scrubSecrets(input.adapterConfig, SECRET_KEYS))}`
      );
      return {
        ok: false,
        error:
          'e2b adapter not wired (install @e2b/code-interpreter and configure apiKey)',
        durationMs: performance.now() - start,
      };
    }

    // Best-effort SDK call. The shape below is a placeholder that
    // works with @e2b/code-interpreter ≥1.0 — if the SDK shape
    // changes, this block will need updating, but the result
    // envelope contract stays stable.
    try {
      const sdkAny = sdk as {
        Sandbox?: {
          create: (opts: { template: string; apiKey: string }) => Promise<{
            runCode?: (code: string) => Promise<{
              logs?: { stdout?: string[]; stderr?: string[] };
              error?: { name?: string; value?: string } | null;
            }>;
            commands?: {
              run: (cmd: string) => Promise<{
                stdout?: string;
                stderr?: string;
                exitCode?: number;
              }>;
            };
            sandboxID?: string;
            kill: () => Promise<void>;
          }>;
        };
      };

      if (!sdkAny.Sandbox?.create) {
        return {
          ok: false,
          error: 'e2b adapter not wired (Sandbox.create not found in SDK)',
          durationMs: performance.now() - start,
        };
      }

      const sandbox = await sdkAny.Sandbox.create({
        template: config.templateId,
        apiKey: config.apiKey,
      });

      try {
        if (sandbox.commands) {
          const result = await sandbox.commands.run(config.command);
          const durationMs = performance.now() - start;
          const exitCode = result.exitCode ?? 0;
          return {
            ok: exitCode === 0,
            externalRunId: sandbox.sandboxID,
            error:
              exitCode === 0
                ? undefined
                : `e2b command exited with code ${exitCode}`,
            result: {
              stdout: result.stdout ?? '',
              stderr: result.stderr ?? '',
              exitCode,
            },
            durationMs,
          };
        }

        if (sandbox.runCode) {
          const result = await sandbox.runCode(config.command);
          const durationMs = performance.now() - start;
          const stdout = (result.logs?.stdout ?? []).join('');
          const stderr = (result.logs?.stderr ?? []).join('');
          const hasError = !!result.error;
          return {
            ok: !hasError,
            externalRunId: sandbox.sandboxID,
            error: hasError
              ? `e2b code error: ${result.error?.name}: ${result.error?.value}`
              : undefined,
            result: { stdout, stderr },
            durationMs,
          };
        }

        return {
          ok: false,
          error: 'e2b sandbox does not expose commands.run or runCode',
          durationMs: performance.now() - start,
        };
      } finally {
        // Best-effort kill — don't block resolve on cleanup.
        sandbox.kill().catch(err => {
          this.logger.debug(
            `e2b sandbox kill failed for agent=${input.agentId}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `e2b invocation failed for agent=${input.agentId}: ${message}. ` +
          `config=${JSON.stringify(scrubSecrets(input.adapterConfig, SECRET_KEYS))}`
      );
      return {
        ok: false,
        error: message,
        durationMs: performance.now() - start,
      };
    }
  }

  /**
   * Indirection so tests can stub out the SDK loader without needing
   * an actual `@e2b/code-interpreter` installation in CI. The module
   * identifier is templated through a variable expression so the TS
   * compiler doesn't try to resolve it at typecheck time — the
   * package is opt-in and not declared in `dependencies`.
   */
  protected async loadSdk(): Promise<unknown> {
    const moduleId = '@e2b/code-interpreter';
    try {
      // The cast-via-string-template prevents TypeScript from
      // resolving the literal module identifier at compile time.
      return await import(`${moduleId}`);
    } catch {
      throw new Error(`${moduleId} not installed`);
    }
  }
}
