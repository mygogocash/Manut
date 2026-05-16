// MANUT: base storage quota for the lazy auto-grow model on self-hosted.
// The effective quota grows by MANUT_STORAGE_GROWTH_FACTOR whenever usage
// reaches MANUT_STORAGE_GROWTH_THRESHOLD of the prior effective quota — see
// `effectiveStorageQuota` for the geometric-growth formula. This preserves
// the FOSS-unlimited policy (no hard cap) while showing users a realistic
// capacity they're close to needing, rather than a 100 GB placeholder they
// will never approach.
export const MANUT_BASE_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
export const MANUT_STORAGE_GROWTH_THRESHOLD = 0.8;
export const MANUT_STORAGE_GROWTH_FACTOR = 1.2;

// Runaway guard. With realistic usage (< 1 PB) the loop terminates in ~85
// iterations even from a 1-byte base; this is a defence-in-depth cap that
// matches the `MANUT_UNLIMITED_BYTES` sentinel used elsewhere in the quota
// module, so the auto-grow can never produce a value outside that bound.
const MANUT_STORAGE_QUOTA_CAP_BYTES = 1_000_000_000_000_000;

/**
 * Returns the effective storage quota (bytes) for a given current usage,
 * applying the MANUT lazy auto-grow rule:
 *
 *   quota = smallest BASE * FACTOR^k such that usage < THRESHOLD * quota
 *
 * Concretely: start at 5 GB. Whenever usage hits 80% of the current
 * quota, grow by 20% (rounded up to a whole byte). Repeat. The function
 * is pure and stateless — same usage always yields the same quota — so
 * there is no persistence and no race window.
 *
 * Invalid inputs (NaN, negative) fall back to BASE. Non-finite or
 * pathologically large inputs saturate at the cap so the loop cannot
 * run indefinitely.
 */
export function effectiveStorageQuota(usageBytes: number): number {
  if (!Number.isFinite(usageBytes) || usageBytes < 0) {
    return usageBytes === Number.POSITIVE_INFINITY
      ? MANUT_STORAGE_QUOTA_CAP_BYTES
      : MANUT_BASE_STORAGE_QUOTA_BYTES;
  }

  let quota = MANUT_BASE_STORAGE_QUOTA_BYTES;
  while (usageBytes >= MANUT_STORAGE_GROWTH_THRESHOLD * quota) {
    const next = Math.ceil(quota * MANUT_STORAGE_GROWTH_FACTOR);
    if (next >= MANUT_STORAGE_QUOTA_CAP_BYTES || next <= quota) {
      return MANUT_STORAGE_QUOTA_CAP_BYTES;
    }
    quota = next;
  }
  return quota;
}
