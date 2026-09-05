/** Fail-closed GL posting gate (env string from Worker bindings). */
export function isGlPostingEnabled(env?: { ACCOUNTING_GL_POSTING?: string }): boolean {
  return env?.ACCOUNTING_GL_POSTING === "true";
}

/** Fail-closed multi-invoice settlement v2 gate. */
export function isSettlementV2Enabled(env?: { ACCOUNTING_SETTLEMENT_V2?: string }): boolean {
  return env?.ACCOUNTING_SETTLEMENT_V2 === "true";
}

/** Fail-closed fixed asset register gate. */
export function isFixedAssetsEnabled(env?: { ACCOUNTING_FIXED_ASSETS?: string }): boolean {
  return env?.ACCOUNTING_FIXED_ASSETS === "true";
}
