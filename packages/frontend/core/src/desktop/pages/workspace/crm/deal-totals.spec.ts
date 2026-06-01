import { describe, expect, it } from 'vitest';

import type { MnCrmDeal } from '../../../../modules/manut-crm';
import { summarizeDealColumn, toExternalHref } from './deal-totals';

const makeDeal = (over: Partial<MnCrmDeal>): MnCrmDeal => ({
  id: Math.random().toString(36).slice(2),
  workspaceId: 'ws',
  accountId: null,
  contactId: null,
  stageId: 'stage-1',
  name: 'Deal',
  value: null,
  currency: null,
  probability: null,
  expectedCloseAt: null,
  ownerUserId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('summarizeDealColumn', () => {
  it('summarizeDealColumn > given no deals > then count 0 and no currency total', () => {
    const result = summarizeDealColumn([]);
    expect(result).toEqual({ count: 0, total: null, currency: null });
  });

  it('summarizeDealColumn > given deals all sharing one currency > then sums and reports that currency', () => {
    const deals = [
      makeDeal({ value: 100, currency: 'USD' }),
      makeDeal({ value: 250, currency: 'USD' }),
    ];
    const result = summarizeDealColumn(deals);
    expect(result).toEqual({ count: 2, total: 350, currency: 'USD' });
  });

  it('summarizeDealColumn > given a column with mixed currencies > then total is null (no bogus single-currency total)', () => {
    const deals = [
      makeDeal({ value: 100, currency: 'USD' }),
      makeDeal({ value: 100, currency: 'EUR' }),
    ];
    const result = summarizeDealColumn(deals);
    expect(result.currency).toBeNull();
    expect(result.total).toBeNull();
    expect(result.count).toBe(2);
  });

  it('summarizeDealColumn > given deals with null currency > then they group under the USD default', () => {
    const deals = [
      makeDeal({ value: 100, currency: null }),
      makeDeal({ value: 50, currency: 'USD' }),
    ];
    const result = summarizeDealColumn(deals);
    expect(result).toEqual({ count: 2, total: 150, currency: 'USD' });
  });

  it('summarizeDealColumn > given a deal with null value > then it counts as 0 toward the single-currency total', () => {
    const deals = [
      makeDeal({ value: null, currency: 'USD' }),
      makeDeal({ value: 75, currency: 'USD' }),
    ];
    const result = summarizeDealColumn(deals);
    expect(result).toEqual({ count: 2, total: 75, currency: 'USD' });
  });
});

describe('toExternalHref', () => {
  it('toExternalHref > given a bare domain > then prefixes https:// so the link is absolute', () => {
    expect(toExternalHref('example.com')).toBe('https://example.com');
  });

  it('toExternalHref > given an http url > then keeps it as-is', () => {
    expect(toExternalHref('http://example.com')).toBe('http://example.com');
  });

  it('toExternalHref > given an https url > then keeps it as-is', () => {
    expect(toExternalHref('https://example.com/path')).toBe(
      'https://example.com/path'
    );
  });

  it('toExternalHref > given surrounding whitespace > then trims before normalizing', () => {
    expect(toExternalHref('  example.com  ')).toBe('https://example.com');
  });
});
