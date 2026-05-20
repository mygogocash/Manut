// MANUT Wave 2 (T-1.1.5.a) — pure tier definitions.
//
// This file is intentionally dependency-free (no NestJS, no models, no
// storage imports) so it can be unit-tested without dragging in the
// native binding loaded transitively by `service.ts`'s imports. Mirrors
// the same separation as `./effective-storage-quota.ts`.
//
// IMPLEMENTATION_PLAN §0.3 (decisions #19 + #26):
//   Free tier: unlimited members + 2 GB storage + $5/mo AI
//   Pro tier:  unlimited members + 100 GB storage + $50/mo AI (up to $200)
//
// The `workspace.plan` column ships in E3.3 (Month 3). Until then every
// workspace reads `undefined`/`null` and `tierFor` grandfathers them
// into FREE_TIER (by design — no data migration needed).

export const FREE_TIER = {
  memberLimit: Number.MAX_SAFE_INTEGER, // unlimited (decision #26)
  storageBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  aiBudgetUsdCents: 500, // $5/mo
} as const;

export const PRO_TIER = {
  memberLimit: Number.MAX_SAFE_INTEGER, // unlimited (decision #26)
  storageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
  aiBudgetUsdCents: 5000, // $50/mo (configurable up to $200 per #19)
} as const;

export type ManutTier = typeof FREE_TIER | typeof PRO_TIER;

/**
 * Defensive lookup: `plan === 'pro'` routes through PRO_TIER, every
 * other input (including `null`, `undefined`, `'free'`, and any unknown
 * value) falls through to FREE_TIER as a safety net.
 */
export function tierFor(plan: string | null | undefined): ManutTier {
  return plan === 'pro' ? PRO_TIER : FREE_TIER;
}

/**
 * Structured payload thrown alongside `StorageQuotaExceeded` so the
 * frontend `StorageCapModal` can render the "X GB of Y GB used" copy
 * without an extra round-trip. The error class itself is argless (see
 * `errors.gen.ts`) — we serialise the numbers into the message string
 * as a JSON blob and let the frontend parse them back out. Until the
 * generated error class is updated to carry typed args (separate R1),
 * this is the lightest-touch fix that keeps the existing GraphQL
 * envelope shape intact.
 */
export interface StorageCapDetail {
  error: 'STORAGE_CAP';
  currentBytes: number;
  capBytes: number;
}

export function storageCapMessage(detail: StorageCapDetail): string {
  return JSON.stringify(detail);
}
