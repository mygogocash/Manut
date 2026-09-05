import {
  type CurrencyOption,
  FX_DEFAULT_CURRENCY_CODES,
  ISO_CURRENCIES,
} from "@nexora/utils";

/** Reporting currency. Needs no FX rate, so it is never in the convertible set. */
export const REPORTING_CURRENCY = "THB";

const BY_CODE = new Map(ISO_CURRENCIES.map((c) => [c.code, c]));

function optionFor(code: string): CurrencyOption {
  return BY_CODE.get(code) ?? { code, name: code };
}

/**
 * Currencies the claim form offers, in the order a submitter wants them.
 *
 * The form used to hardcode AED/USD/EUR/GBP and default to AED. That list
 * managed to be wrong in both directions at once: it withheld INR (so Indian
 * staff could not file in their own currency at all) and THB (the reporting
 * currency), while offering AED, which the FX service held no rate for — so a
 * claim left on the default could not be converted and only surfaced later as
 * a missing-rate line on the report.
 *
 * The order is deliberate. The submitter's own entity currency comes first
 * because it is what they are overwhelmingly filing in; THB second as the
 * reporting currency; then everything the FX sync can convert. Anything not
 * convertible is left out, so an unfileable claim cannot be created — the
 * failure moves from silent, weeks later, to impossible.
 */
export function claimCurrencyOptions(
  entityCurrency?: string | null,
): CurrencyOption[] {
  const seen = new Set<string>();
  const out: CurrencyOption[] = [];

  const push = (raw: string | null | undefined) => {
    const code = raw?.trim().toUpperCase();
    if (!code || seen.has(code)) return;
    seen.add(code);
    out.push(optionFor(code));
  };

  // An entity configured with something exotic still gets its own currency
  // offered — refusing to show it would block that entity entirely, which is
  // worse than a line the FX sync cannot convert.
  push(entityCurrency);
  push(REPORTING_CURRENCY);
  for (const code of FX_DEFAULT_CURRENCY_CODES) push(code);

  return out;
}

/**
 * What the currency field should start on: the submitter's entity currency,
 * falling back to the reporting currency.
 *
 * Never a fixed foreign default. AED was one, and being plausible-looking is
 * exactly why nobody noticed it was also unconvertible.
 */
export function defaultClaimCurrency(entityCurrency?: string | null): string {
  const code = entityCurrency?.trim().toUpperCase();
  return code || REPORTING_CURRENCY;
}
