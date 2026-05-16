import test from 'ava';

import {
  effectiveStorageQuota,
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
