import { spawn } from 'node:child_process';

import { Injectable, Logger } from '@nestjs/common';
import { MnAgentAdapterType } from '@prisma/client';

import type {
  MnAdapter,
  MnAdapterInvokeInput,
  MnAdapterResult,
} from './manut-adapter.interface';
import { scrubSecrets } from './manut-adapter.interface';

/** Default per-invocation timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Cap on stdout/stderr captured per invocation, bytes. */
const MAX_OUTPUT_BYTES = 1_048_576; // 1 MiB

/** Config field names whose VALUES are scrubbed before logging. */
const SECRET_KEYS = ['env'] as const;

/** Shape of `adapterConfig` for a PROCESS_COMMAND adapter. */
export interface ProcessAdapterConfig {
  /**
   * The command name (e.g. `echo`, `python`, `node`). MUST appear in
   * `commandAllowlist` — otherwise invocation is rejected before
   * `spawn()` is called.
   */
  command: string;
  /** Static args passed to the command. */
  args?: string[];
  /**
   * Optional environment variables passed to the child process.
   * Values are scrubbed in logs because they often contain secrets.
   */
  env?: Record<string, string>;
  /**
   * Per-workspace allowlist of permitted commands. Required for safety
   * — a config without an allowlist is rejected at validate time so
   * the adapter cannot be misused to run arbitrary shell commands.
   */
  commandAllowlist: string[];
  /** Per-invocation timeout in milliseconds. Defaults to 60s. */
  timeoutMs?: number;
  /** Working directory for the child process. */
  cwd?: string;
}

/**
 * M8 — Local process command adapter.
 *
 * Spawns a child process via `child_process.spawn`, captures
 * stdout/stderr/exit, and returns them as the invocation result.
 *
 * Safety invariants:
 *
 *  1. `command` MUST appear in `commandAllowlist`. There is no path
 *     where an out-of-allowlist command reaches `spawn()`.
 *  2. `args` are passed as an array (no shell interpolation), so
 *     callers cannot smuggle shell metacharacters through positional
 *     arguments.
 *  3. `env` values are scrubbed before any log line.
 *  4. Output is capped at MAX_OUTPUT_BYTES per stream so a runaway
 *     process can't OOM the host.
 *  5. The timeout is enforced with `SIGTERM` then `SIGKILL` 2s later;
 *     the call resolves with `ok: false` rather than hanging.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` — see HTTP webhook adapter for the rationale.
 *  - Secret-scrubbing on the only field that holds them (`env`).
 */
@Injectable()
export class MnProcessAdapter implements MnAdapter {
  readonly adapterType: MnAgentAdapterType = MnAgentAdapterType.PROCESS_COMMAND;

  private readonly logger = new Logger(MnProcessAdapter.name);

  validateConfig(adapterConfig: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    const command = adapterConfig.command;
    if (typeof command !== 'string' || command.length === 0) {
      errors.push('command is required and must be a non-empty string');
    }

    const args = adapterConfig.args;
    if (
      args !== undefined &&
      args !== null &&
      (!Array.isArray(args) ||
        !args.every((arg): arg is string => typeof arg === 'string'))
    ) {
      errors.push('args must be an array of strings');
    }

    const env = adapterConfig.env;
    if (env !== undefined && env !== null) {
      if (typeof env !== 'object' || Array.isArray(env)) {
        errors.push('env must be an object of string→string');
      } else {
        for (const [key, value] of Object.entries(env)) {
          if (typeof value !== 'string') {
            errors.push(`env.${key} must be a string`);
            break;
          }
        }
      }
    }

    const allowlist = adapterConfig.commandAllowlist;
    if (
      !Array.isArray(allowlist) ||
      !allowlist.every((c): c is string => typeof c === 'string') ||
      allowlist.length === 0
    ) {
      errors.push(
        'commandAllowlist is required and must be a non-empty array of strings'
      );
    } else if (typeof command === 'string' && !allowlist.includes(command)) {
      errors.push(
        `command '${command}' is not in commandAllowlist ` +
          `(allowed: ${allowlist.join(', ')})`
      );
    }

    const timeout = adapterConfig.timeoutMs;
    if (
      timeout !== undefined &&
      timeout !== null &&
      (typeof timeout !== 'number' || timeout <= 0 || timeout > 600_000)
    ) {
      errors.push('timeoutMs must be a positive number ≤ 600000');
    }

    const cwd = adapterConfig.cwd;
    if (cwd !== undefined && cwd !== null && typeof cwd !== 'string') {
      errors.push('cwd must be a string');
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

    const config = input.adapterConfig as unknown as ProcessAdapterConfig;
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const start = performance.now();

    return new Promise<MnAdapterResult>(resolve => {
      let child;
      try {
        child = spawn(config.command, config.args ?? [], {
          env: config.env,
          cwd: config.cwd,
          // No shell. Args are passed positionally; no metacharacter
          // expansion possible. This is the most important safety
          // property of this adapter.
          shell: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `spawn() failed for agent=${input.agentId} ` +
            `command=${config.command}: ${message}. ` +
            `config=${JSON.stringify(scrubSecrets(input.adapterConfig, SECRET_KEYS))}`
        );
        resolve({
          ok: false,
          error: `failed to spawn '${config.command}': ${message}`,
          durationMs: performance.now() - start,
        });
        return;
      }

      let stdout = '';
      let stderr = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;

      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes <= MAX_OUTPUT_BYTES) {
          stdout += chunk.toString('utf8');
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes <= MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf8');
        }
      });

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        // Hard kill if it doesn't exit cleanly within 2 seconds.
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 2_000);
      }, timeoutMs);

      child.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        resolve({
          ok: false,
          error: `process error: ${err.message}`,
          durationMs: performance.now() - start,
        });
      });

      child.on(
        'close',
        (exitCode: number | null, signal: NodeJS.Signals | null) => {
          clearTimeout(timeoutHandle);
          const durationMs = performance.now() - start;

          if (timedOut) {
            resolve({
              ok: false,
              error: `process timed out after ${timeoutMs}ms`,
              durationMs,
              result: { stdout, stderr, exitCode, signal },
            });
            return;
          }

          const ok = exitCode === 0;
          resolve({
            ok,
            error: ok
              ? undefined
              : `process exited with code ${exitCode ?? 'null'}` +
                (signal ? ` (signal=${signal})` : ''),
            result: { stdout, stderr, exitCode, signal },
            durationMs,
          });
        }
      );
    });
  }
}
