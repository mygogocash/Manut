import test from 'ava';

import {
  effectiveStorageQuota,
  isStorageOverQuotaAfterUpload,
  MANUT_BASE_STORAGE_QUOTA_BYTES,
  MANUT_STORAGE_GROWTH_FACTOR,
  MANUT_STORAGE_GROWTH_THRESHOLD,
} from '../../core/quota/effective-storage-quota';

const BASE = MANUT_BASE_STORAGE_QUOTA_BYTES;
const THRESHOLD = MANUT_STORAGE_GROWTH_THRESHOLD;
const FACTOR = MANUT_STORAGE_GROWTH_FACTOR;

test('constants > BASE is 5 GB (binary), THRESHOLD 0.8, FACTOR 1.2', t => {
  t.is(BASE, 5 * 1024 * 1024 * 1024);
  t.is(THRESHOLD, 0.8);
  t.is(FACTOR, 1.2);
});

test('effectiveStorageQuota > given zero usage > returns BASE', t => {
  t.is(effectiveStorageQuota(0), BASE);
});

test('effectiveStorageQuota > given usage just below 80% threshold > returns BASE (no growth)', t => {
  const justBelow = Math.floor(THRESHOLD * BASE) - 1;
  t.is(effectiveStorageQuota(justBelow), BASE);
});

test('effectiveStorageQuota > given usage exactly at 80% threshold > grows by one step', t => {
  const atThreshold = Math.ceil(THRESHOLD * BASE);
  const expected = Math.ceil(BASE * FACTOR);
  t.is(effectiveStorageQuota(atThreshold), expected);
});

test('effectiveStorageQuota > given usage requiring multiple growth steps > grows geometrically', t => {
  const usage = BASE * 2;
  let expected = BASE;
  while (usage >= THRESHOLD * expected) {
    expected = Math.ceil(expected * FACTOR);
  }
  t.is(effectiveStorageQuota(usage), expected);
});

test('effectiveStorageQuota > result is always strictly larger than usage / threshold', t => {
  for (const usage of [0, 1_000_000, 1e9, 5e9, 1e10, 1e11, 1e12]) {
    const quota = effectiveStorageQuota(usage);
    if (usage > 0) {
      t.true(
        quota > usage / THRESHOLD - 1,
        `usage ${usage} → quota ${quota} should leave headroom above threshold`
      );
    }
    t.true(quota >= BASE, `quota ${quota} should never go below BASE`);
  }
});

test('effectiveStorageQuota > is monotonically non-decreasing in usage', t => {
  const samples = [0, 1_000_000, 1e9, 5e9, 1e10, 1e11, 1e12];
  const results = samples.map(effectiveStorageQuota);
  for (let i = 1; i < results.length; i++) {
    t.true(
      results[i] >= results[i - 1],
      `usage ${samples[i]} → ${results[i]} should be >= prev usage ${samples[i - 1]} → ${results[i - 1]}`
    );
  }
});

test('effectiveStorageQuota > always returns a safe integer', t => {
  for (const usage of [0, 4 * 1024 ** 3, 100 * 1024 ** 3, 1024 ** 4]) {
    const quota = effectiveStorageQuota(usage);
    t.true(
      Number.isSafeInteger(quota),
      `quota ${quota} must be a safe integer for GraphQL SafeIntResolver`
    );
  }
});

test('effectiveStorageQuota > negative usage > returns BASE', t => {
  t.is(effectiveStorageQuota(-1), BASE);
  t.is(effectiveStorageQuota(-1_000_000), BASE);
});

test('effectiveStorageQuota > NaN usage > returns BASE', t => {
  t.is(effectiveStorageQuota(Number.NaN), BASE);
});

test('effectiveStorageQuota > Infinity usage > saturates to a safe integer (runaway guard)', t => {
  const result = effectiveStorageQuota(Number.POSITIVE_INFINITY);
  t.true(Number.isSafeInteger(result));
  t.true(result >= BASE);
});

// ---------------------------------------------------------------------------
// isStorageOverQuotaAfterUpload — regression tests for PR #76 P1 (Codex)
//
// The calculator was evaluating effective quota against the PRE-upload size,
// so a single large blob upload (e.g. 6 GB to an empty workspace) was being
// rejected on the 5 GB BASE even though the auto-grow rule should have
// applied to the post-upload size. The helper below is the testable surface
// of the fix.
// ---------------------------------------------------------------------------

const GB = 1024 ** 3;

test('isStorageOverQuotaAfterUpload > autoGrow=true > 6 GB upload to empty workspace > allowed', t => {
  // Regression: this is the exact case Codex caught. Pre-fix, the calculator
  // computed quota = effectiveStorageQuota(0) = 5 GB and rejected the upload.
  // Post-fix, quota = effectiveStorageQuota(6 GB) ≈ 8.64 GB and the upload
  // fits.
  const result = isStorageOverQuotaAfterUpload({
    usedSize: 0,
    recvSize: 6 * GB,
    storageQuota: BASE,
    autoGrow: true,
  });
  t.false(result.exceeded);
  t.true(result.effectiveQuota >= 6 * GB);
});

test('isStorageOverQuotaAfterUpload > autoGrow=true > incremental 1 GB upload at 4 GB used > allowed', t => {
  // 5 GB post-upload, just crosses the threshold of BASE. Post-fix quota
  // grows to BASE * 1.2 = 6 GB; pre-fix quota stayed at BASE = 5 GB and
  // the check would have been 5 GB > 5 GB → exceeded.
  const result = isStorageOverQuotaAfterUpload({
    usedSize: 4 * GB,
    recvSize: 1 * GB,
    storageQuota: BASE,
    autoGrow: true,
  });
  t.false(result.exceeded);
});

test('isStorageOverQuotaAfterUpload > autoGrow=true > 5 GB upload at 4 GB used (multi-grow) > allowed', t => {
  // 9 GB post-upload requires several growth steps from 5 GB BASE.
  const result = isStorageOverQuotaAfterUpload({
    usedSize: 4 * GB,
    recvSize: 5 * GB,
    storageQuota: BASE,
    autoGrow: true,
  });
  t.false(result.exceeded);
  t.true(result.effectiveQuota >= 9 * GB);
});

test('isStorageOverQuotaAfterUpload > autoGrow=true > pathologically huge upload (>1 PB cap) > rejected by runaway guard', t => {
  // The 1 PB MANUT_UNLIMITED_BYTES cap is a defence-in-depth runaway guard.
  // Any single upload that would exceed it is rejected.
  const result = isStorageOverQuotaAfterUpload({
    usedSize: 0,
    recvSize: 2 * 1_000_000_000_000_000,
    storageQuota: BASE,
    autoGrow: true,
  });
  t.true(result.exceeded);
});

test('isStorageOverQuotaAfterUpload > autoGrow=false > 6 GB upload to empty workspace at 5 GB cap > rejected', t => {
  // Hosted (non-self-hosted) path still enforces the literal storageQuota.
  // This is the AFFiNE cloud behaviour — paid tiers, fixed cap per plan.
  const result = isStorageOverQuotaAfterUpload({
    usedSize: 0,
    recvSize: 6 * GB,
    storageQuota: BASE,
    autoGrow: false,
  });
  t.true(result.exceeded);
  t.is(result.effectiveQuota, BASE);
});

test('isStorageOverQuotaAfterUpload > unlimited=true > never rejects, even at 1 PB', t => {
  // `unlimited_workspace` feature flag short-circuits the check entirely.
  const result = isStorageOverQuotaAfterUpload({
    usedSize: 0,
    recvSize: 1_000_000_000_000_000,
    storageQuota: BASE,
    autoGrow: false,
    unlimited: true,
  });
  t.false(result.exceeded);
});
