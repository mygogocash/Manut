import type { MnAgentAdapterType } from '@prisma/client';

/**
 * M8 — Cloud / sandbox agent adapter base contract.
 *
 * Every `MnAgentAdapterType` variant other than `COPILOT_CHAT_SESSION`
 * (M1, which dispatches via AiSession) must resolve to a concrete
 * `MnAdapter` implementation through `MnAdapterRegistryService`.
 *
 * Adapter responsibilities:
 *
 *  1. `validateConfig` — pure synchronous schema check against the
 *     row's `adapterConfig` JSON column. Used at agent CRUD time so
 *     misconfiguration surfaces before the first invocation, and at
 *     invoke-time as a defensive check. Returns a list of human-readable
 *     errors; an empty list (and `valid: true`) means the config is
 *     ready to use.
 *
 *  2. `invoke` — actually call out to the external system. Wraps
 *     transport-level failures into the `MnAdapterResult` envelope
 *     (`ok: false` + `error`) rather than throwing — the heartbeat
 *     consumer relies on a stable contract so a misbehaving adapter
 *     can't blow up the dispatch loop. `durationMs` is required
 *     because the budget enforcer (M4) feeds it directly into
 *     `MnCostEvent.durationMs`.
 *
 * Secret handling — see also CLAUDE.md "Secret Management" section.
 * The four concrete adapters in this directory each have at least one
 * secret-bearing config field (`apiKey`, `signingSecret`, etc.). Those
 * fields MUST NOT appear in any log line — every adapter scrubs them
 * before logging by depending on `scrubSecrets()` (or equivalent
 * Logger.debug calls that only reference the non-secret fields).
 */
export interface MnAdapter {
  /** The MnAgentAdapterType variant this adapter resolves. */
  readonly adapterType: MnAgentAdapterType;

  /**
   * Side-effect-free schema check. Returns `{ valid: true, errors: [] }`
   * when the supplied `adapterConfig` JSON is structurally valid for
   * this adapter. Implementations should NOT call out to the external
   * system here — that's `invoke`'s job.
   */
  validateConfig(adapterConfig: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  };

  /**
   * Dispatch a single invocation. Implementations must:
   *
   *  - never throw on transport-level failures — wrap into
   *    `{ ok: false, error }` so the caller can record a clean
   *    `MnExecutionRun.status = FAILED` row.
   *  - never log secret fields in plaintext.
   *  - always populate `durationMs`, even on failure (use a monotonic
   *    `performance.now()` measurement around the work).
   */
  invoke(input: MnAdapterInvokeInput): Promise<MnAdapterResult>;
}

/** Common invocation envelope passed from the heartbeat consumer to an adapter. */
export interface MnAdapterInvokeInput {
  agentId: string;
  workspaceId: string;
  /**
   * Free-form payload supplied by the caller (e.g. a copilot tool
   * call's structured args, or a webhook body). Adapters interpret
   * this against their own config + the agent's `runtimeConfig`.
   */
  payload: Record<string, unknown>;
  /**
   * Already-loaded adapter config from `MnAgent.adapterConfig`. Passed
   * so the adapter doesn't have to round-trip Postgres on every call.
   * Secrets are still in this object — adapters MUST NOT log it.
   */
  adapterConfig: Record<string, unknown>;
}

/** Envelope returned from every adapter invocation. */
export interface MnAdapterResult {
  /** `true` iff the external system accepted the invocation. */
  ok: boolean;
  /**
   * Opaque identifier the adapter received back from the external
   * system (e.g. an e2b sandbox id, a webhook delivery id). Used for
   * idempotent retries + linking back to the external dashboard.
   */
  externalRunId?: string;
  /** Whatever structured result the external system returned. */
  result?: unknown;
  /** Human-readable error message when `ok === false`. */
  error?: string;
  /** Monotonic wall-clock duration of the `invoke` call in milliseconds. */
  durationMs: number;
}

/**
 * Best-effort secret scrubber. Replaces values of any key in
 * `secretKeys` with `'[redacted]'`. Used by adapters before logging
 * the adapterConfig shape for debugging. Defensive against nested
 * objects only one level deep — the configs we expect are flat
 * key/value bags, so this is sufficient. Returns a NEW object so the
 * caller's input is never mutated (CLAUDE.md immutability rule).
 */
export function scrubSecrets(
  config: Record<string, unknown>,
  secretKeys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (secretKeys.includes(key)) {
      out[key] = '[redacted]';
    } else {
      out[key] = value;
    }
  }
  return out;
}
