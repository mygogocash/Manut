import type { MnCrmDeal } from '../../../../modules/manut-crm';

const DEFAULT_CURRENCY = 'USD';

export interface DealColumnSummary {
  /** Number of deals in the column. */
  count: number;
  /**
   * Summed deal value, but only when every deal shares a single currency.
   * `null` when the column is empty or contains mixed currencies, so the UI
   * never formats a meaningless cross-currency sum.
   */
  total: number | null;
  /** The shared currency code, or `null` when empty / mixed. */
  currency: string | null;
}

/**
 * Summarise a Kanban column's deals, grouping by currency so the UI can
 * decide whether a single currency-formatted total is meaningful.
 *
 * A deal with no explicit `currency` is bucketed under {@link DEFAULT_CURRENCY}
 * — matching how the create/edit forms default. When a column mixes
 * currencies, `total` and `currency` are `null` so callers render a plain
 * count (or "Mixed") instead of a bogus single-currency sum.
 *
 * Pure: no React, no service access — safe to unit test in isolation.
 */
export const summarizeDealColumn = (
  deals: readonly MnCrmDeal[]
): DealColumnSummary => {
  if (deals.length === 0) {
    return { count: 0, total: null, currency: null };
  }

  const currencies = new Set(
    deals.map(deal => deal.currency ?? DEFAULT_CURRENCY)
  );

  if (currencies.size > 1) {
    return { count: deals.length, total: null, currency: null };
  }

  const total = deals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);
  const [currency] = currencies;

  return { count: deals.length, total, currency: currency ?? null };
};

/**
 * Normalize a user-entered website into an absolute, safe external href.
 * Bare domains (e.g. `example.com`) get an `https://` scheme so the anchor
 * is treated as external rather than a relative app route.
 */
export const toExternalHref = (url: string): string => {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};
