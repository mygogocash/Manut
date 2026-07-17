/**
 * Resilient currency formatter for the dashboard.
 *
 * `Intl.NumberFormat({style: "currency", currency: "..."})` requires a
 * valid ISO-4217 code — pass it the rupee glyph `₹` (or `฿`, `$` etc.)
 * and it throws `RangeError: Invalid currency code : ₹`, which bubbles
 * up to the nearest React error boundary and white-screens the page.
 *
 * Legacy expense rows in this codebase sometimes carry currency
 * symbols instead of ISO codes (a stricter backend validator is the
 * proper fix, but old rows already exist). This helper:
 *   1. Maps the handful of common symbols we see in the wild to ISO.
 *   2. Trims + uppercases anything else and tries it as-is.
 *   3. Falls back to `"<raw> <amount>"` plain output on RangeError so
 *      the page renders instead of crashing.
 */

// Symbol → ISO map for the rows already in the DB. Extend cautiously
// — ambiguous symbols (e.g. `$` could mean USD, AUD, SGD, CAD) keep
// their most common reading here. If a tenant disagrees, prefer
// storing the ISO code on write rather than guessing at render.
const CURRENCY_SYMBOL_TO_ISO: Record<string, string> = {
  "₹": "INR",
  "฿": "THB",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₩": "KRW",
  "₫": "VND",
  "₱": "PHP",
  "₨": "PKR",
  "৳": "BDT",
};

/**
 * Best-effort normalisation: returns an ISO-shaped code or `null` if
 * the input doesn't look like a currency at all. ISO check is loose
 * — three uppercase letters — to keep the formatter compatible with
 * uncommon currencies (KZT, ETB) without maintaining the full ISO list.
 */
export function normaliseCurrencyCode(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const mapped = CURRENCY_SYMBOL_TO_ISO[trimmed];
  if (mapped) return mapped;
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return null;
}

/**
 * Format an amount with a best-effort currency code. Always renders —
 * never throws. Falls back to `"<raw> <amount>"` (or just the amount)
 * if the input can't be normalised to a valid ISO code, or if the
 * runtime's `Intl.NumberFormat` rejects the normalised code on this
 * platform.
 */
export function formatCurrency(
  amount: number | string,
  currency: string | null | undefined,
  options?: Intl.NumberFormatOptions & { locale?: string },
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const safeValue = Number.isFinite(value) ? value : 0;
  const iso = normaliseCurrencyCode(currency);
  const { locale, ...formatOptions } = options ?? {};

  if (iso) {
    try {
      return new Intl.NumberFormat(locale ?? "en-US", {
        style: "currency",
        currency: iso,
        currencyDisplay: "code",
        minimumFractionDigits: 2,
        ...formatOptions,
      }).format(safeValue);
    } catch {
      // fall through to the plain renderer
    }
  }

  // Plain renderer — keeps the raw symbol/string the row was stored
  // with so the operator can still recognise it, just without the
  // locale-aware grouping.
  const formatted = new Intl.NumberFormat(locale ?? "en-US", {
    minimumFractionDigits: 2,
    ...formatOptions,
  }).format(safeValue);
  return currency ? `${currency} ${formatted}` : formatted;
}
