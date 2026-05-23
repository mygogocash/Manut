import test from 'ava';

import {
  FREE_TIER,
  MANUT_UNLIMITED_MEMBER_LIMIT,
  PRO_TIER,
  storageCapMessage,
  tierFor,
} from '../../core/quota/tiers';

const GB = 1024 ** 3;
const GRAPHQL_INT_MAX = 2_147_483_647;

test('FREE_TIER > shape matches IMPLEMENTATION_PLAN §0.3 (decision #26)', t => {
  t.is(FREE_TIER.memberLimit, MANUT_UNLIMITED_MEMBER_LIMIT);
  t.is(FREE_TIER.storageBytes, 2 * GB);
  t.is(FREE_TIER.aiBudgetUsdCents, 500);
});

test('PRO_TIER > shape matches IMPLEMENTATION_PLAN §0.3 (decision #19)', t => {
  t.is(PRO_TIER.memberLimit, MANUT_UNLIMITED_MEMBER_LIMIT);
  t.is(PRO_TIER.storageBytes, 100 * GB);
  t.is(PRO_TIER.aiBudgetUsdCents, 5000);
});

test('quota graphql > given unlimited numeric value > serializes safely', t => {
  t.true(FREE_TIER.memberLimit <= GRAPHQL_INT_MAX);
  t.true(PRO_TIER.memberLimit <= GRAPHQL_INT_MAX);
});

test('tierFor > given undefined > returns FREE_TIER (grandfathering)', t => {
  t.is(tierFor(undefined), FREE_TIER);
});

test('tierFor > given null > returns FREE_TIER (grandfathering)', t => {
  t.is(tierFor(null), FREE_TIER);
});

test('tierFor > given "free" > returns FREE_TIER', t => {
  t.is(tierFor('free'), FREE_TIER);
});

test('tierFor > given "pro" > returns PRO_TIER', t => {
  t.is(tierFor('pro'), PRO_TIER);
});

test('tierFor > given unknown plan > defaults to FREE_TIER (safety net)', t => {
  t.is(tierFor('enterprise'), FREE_TIER);
  t.is(tierFor(''), FREE_TIER);
  t.is(tierFor('PRO'), FREE_TIER); // case-sensitive on purpose
});

test('storageCapMessage > round-trips through JSON.parse', t => {
  const detail = {
    error: 'STORAGE_CAP' as const,
    currentBytes: 1_900_000_000,
    capBytes: 2 * GB,
  };
  const message = storageCapMessage(detail);
  t.deepEqual(JSON.parse(message), detail);
});

test('storageCapMessage > frontend can extract currentBytes/capBytes from error message', t => {
  // Simulates what the StorageCapModal will do — parse the GraphQL
  // error.message back into a structured payload.
  const message = storageCapMessage({
    error: 'STORAGE_CAP',
    currentBytes: 2_100_000_000,
    capBytes: 2 * GB,
  });
  const parsed = JSON.parse(message);
  t.is(parsed.error, 'STORAGE_CAP');
  t.is(parsed.currentBytes, 2_100_000_000);
  t.is(parsed.capBytes, 2 * GB);
});

test('storageCapMessage > exceeds Free cap implies upgrade is needed', t => {
  // Behavioural: when currentBytes > capBytes, the modal should render
  // the "Upgrade to Pro" CTA. The Pro cap is 50× the Free cap.
  const detail = {
    error: 'STORAGE_CAP' as const,
    // 1 byte over the 2 GB Free cap is the smallest legitimate overage.
    currentBytes: FREE_TIER.storageBytes + 1,
    capBytes: FREE_TIER.storageBytes,
  };
  t.true(detail.currentBytes > detail.capBytes);
  t.true(PRO_TIER.storageBytes > detail.currentBytes);
});
