// Fail-closed GL-posting gate.
//
// When this is off (the default — unset or any value other than "true"),
// accounting documents behave exactly as they do today: a status change is a
// plain status flip with NO journal entry. The auto-posting branch (wired in a
// later milestone) engages only when this flag is "true" AND the document's
// entity has a complete account mapping (see GET /accounting/posting-readiness).
//
// Fail-closed by design: a forgotten or mistyped env value keeps posting OFF,
// so the module can never start mutating the general ledger by accident.
export function isGlPostingEnabled(): boolean {
  return process.env.ACCOUNTING_GL_POSTING === "true";
}

// Fail-closed gate for the M3/M6 multi-invoice settlement write path (one
// receipt → many invoices). Off by default: the allocation data model + engine
// ship first; the write path that lets a single payment clear several invoices
// engages only when this is "true".
export function isSettlementV2Enabled(): boolean {
  return process.env.ACCOUNTING_SETTLEMENT_V2 === "true";
}

// Fail-closed ship-dark gate for the Fixed Asset Register sub-tab. Because
// Fixed Asset reuses the accounting:read permission, it CANNOT be hidden by
// permission alone — a forgotten gate would expose the (empty / mid-build)
// register to every accounting reader in prod. This flag guards the API route
// mount; the web side mirrors it with the build-time NEXT_PUBLIC_ACCOUNTING_
// FIXED_ASSETS var (inlined at `next build`, so it travels via --build-arg,
// not runtime env). Both fail-closed on "true" — flip on only when the register
// is cut over and ready.
export function isFixedAssetsEnabled(): boolean {
  return process.env.ACCOUNTING_FIXED_ASSETS === "true";
}
