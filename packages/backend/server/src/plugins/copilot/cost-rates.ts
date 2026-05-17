/**
 * Versioned price table for AI providers + models.
 *
 * All prices denominated in **USD cents per million tokens** as integers to
 * keep cost arithmetic deterministic. Sub-cent costs round UP at emit time
 * — we'd rather over-bill internally by fractions of a cent than under-bill
 * and have budget caps drift positive on the order of $10s/month.
 *
 * `effectiveFrom` lets us add a future-dated row without overwriting the
 * current one. `pickRate(provider, model)` returns the row with the most
 * recent `effectiveFrom <= now`, which is also how a future price change
 * is rolled out (insert + wait, no atomic swap needed).
 *
 * UNKNOWN model — `pickRate` returns null. The caller (`MnCostService.emit`)
 * is responsible for logging a warning + emitting a $0 cost row so the
 * event audit trail stays complete without invented numbers. Unknown
 * costs are the loudest possible "review your model id" signal short of
 * an outright throw — and we do NOT throw because cost emission must
 * never block the streaming response (CLAUDE.md scar #5).
 *
 * Note: these prices are best-effort snapshots, NOT contractually bound
 * to GCP/Vertex billing. Treat MnBudget as a soft budgeting tool, not a
 * GCP-equivalent billing system. The real source of truth for billing
 * remains the Google Cloud invoice.
 */

export interface CostRate {
  readonly provider: string;
  readonly model: string;
  /** USD cents per million input tokens. */
  readonly inputCentsPerMillion: number;
  /** USD cents per million output tokens. */
  readonly outputCentsPerMillion: number;
  /** ISO 8601 date string. Most recent row <= now wins. */
  readonly effectiveFrom: string;
}

/**
 * Catalogue of rates. Keep newest entries first within a provider/model
 * group so a casual reader can spot the current price quickly. Future
 * rate changes append a new row with a later `effectiveFrom` rather
 * than mutating the existing one.
 */
export const COST_RATES: readonly CostRate[] = [
  // ---- Gemini (Vertex publisher=google) -----------------------------------
  // Prices roughly track Google's public list at the time of v1.12.x.
  // Update via PR + bump `effectiveFrom` when GCP rates change.
  {
    provider: 'geminiVertex',
    model: 'gemini-2.5-flash',
    inputCentsPerMillion: 30,
    outputCentsPerMillion: 250,
    effectiveFrom: '2025-01-01T00:00:00Z',
  },
  {
    provider: 'geminiVertex',
    model: 'gemini-2.5-pro',
    inputCentsPerMillion: 125,
    outputCentsPerMillion: 1000,
    effectiveFrom: '2025-01-01T00:00:00Z',
  },

  // ---- Anthropic (Vertex publisher=anthropic) -----------------------------
  {
    provider: 'anthropicVertex',
    model: 'claude-sonnet-4-5@20250929',
    inputCentsPerMillion: 300,
    outputCentsPerMillion: 1500,
    effectiveFrom: '2025-09-29T00:00:00Z',
  },
  {
    provider: 'anthropicVertex',
    model: 'claude-opus-4@20250514',
    inputCentsPerMillion: 1500,
    outputCentsPerMillion: 7500,
    effectiveFrom: '2025-05-14T00:00:00Z',
  },

  // ---- Vertex Model Garden MaaS (OpenAI-compat) ---------------------------
  // Llama family — Meta's publisher slug is `meta`.
  {
    provider: 'llamaVertex',
    model: 'llama-3.1-70b-instruct-maas',
    inputCentsPerMillion: 72,
    outputCentsPerMillion: 72,
    effectiveFrom: '2025-01-01T00:00:00Z',
  },
  {
    provider: 'llamaVertex',
    model: 'llama-4-scout-17b-16e-instruct-maas',
    inputCentsPerMillion: 25,
    outputCentsPerMillion: 75,
    effectiveFrom: '2025-04-01T00:00:00Z',
  },
];

/**
 * Pick the active rate for `provider`/`model` as of `now`.
 *
 * Matching rules:
 *   1. Exact `provider` + `model` match
 *   2. `effectiveFrom <= now`
 *   3. Among ties, latest `effectiveFrom` wins
 *
 * Returns `null` for unknown models so callers can log + emit $0 without
 * crashing the streaming response.
 */
export function pickRate(
  provider: string,
  model: string,
  now: Date = new Date()
): CostRate | null {
  const nowIso = now.toISOString();
  let best: CostRate | null = null;
  for (const row of COST_RATES) {
    if (row.provider !== provider) continue;
    if (row.model !== model) continue;
    if (row.effectiveFrom > nowIso) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) {
      best = row;
    }
  }
  return best;
}

/**
 * Compute cost in CENTS (rounded UP) for a given (provider, model, input,
 * output) tuple. Returns 0 for unknown models. Sub-cent precision is lost
 * deliberately — see the file header.
 *
 * The integer math is done as `(tokens * centsPerMillion + 999_999) /
 * 1_000_000` to round up without floats. Round-up beats round-half-even
 * here because (a) it's monotonic in tokens, (b) it prevents accidental
 * undercount when a budget is on the wire.
 */
export function computeCostCents(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  now: Date = new Date()
): { costCents: number; rate: CostRate | null } {
  const rate = pickRate(provider, model, now);
  if (!rate) return { costCents: 0, rate: null };

  // Round UP per-component, then sum. Doing the rounding on the sum would
  // produce slightly cheaper costs on small turns; per-component rounding
  // matches what most billing systems do.
  const inputCents =
    Math.floor(
      (Math.max(0, inputTokens) * rate.inputCentsPerMillion + 999_999) /
        1_000_000
    ) | 0;
  const outputCents =
    Math.floor(
      (Math.max(0, outputTokens) * rate.outputCentsPerMillion + 999_999) /
        1_000_000
    ) | 0;
  return { costCents: inputCents + outputCents, rate };
}
