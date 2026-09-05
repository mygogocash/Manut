import type { RawFieldSource } from "@/services/marketing-analytics.service";

/** Flags for the countries the BNII partner set covers. */
export const COUNTRY_FLAGS: Record<string, string> = {
  "Sri Lanka": "🇱🇰",
  Indonesia: "🇮🇩",
  Bangladesh: "🇧🇩",
  Pakistan: "🇵🇰",
  Myanmar: "🇲🇲",
  Vietnam: "🇻🇳",
  Nigeria: "🇳🇬",
};

export function flagFor(country: string | null | undefined): string {
  return country ? (COUNTRY_FLAGS[country] ?? "") : "";
}

export const SOURCE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "ga4", label: "GA4 · BNII API" },
  { value: "binaryos", label: "BinaryOS Events" },
  { value: "stw", label: "STW Engine" },
  { value: "bnry", label: "BNRY Token Ledger" },
  { value: "bnrymart", label: "BnryMart" },
];

/**
 * Tailwind only sees literal class strings, so keep a static map — an
 * interpolated `bg-${x}-50` would be purged and render unstyled.
 */
export const SOURCE_BADGE: Record<RawFieldSource, string> = {
  time: "bg-slate-50 text-slate-700 ring-slate-200",
  ga4: "bg-blue-50 text-blue-700 ring-blue-200",
  binaryos: "bg-violet-50 text-violet-700 ring-violet-200",
  stw: "bg-amber-50 text-amber-700 ring-amber-200",
  bnry: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  bnrymart: "bg-teal-50 text-teal-700 ring-teal-200",
};

/**
 * Compact number formatting, matching Atlas's `fmt` (atlas-v4.1.html:895).
 *
 * The precision differs per magnitude and that difference is visible: millions
 * carry TWO decimals (3.39M) while thousands carry one (322.6K). `Intl`'s
 * compact notation cannot express that — a single maximumFractionDigits either
 * flattens 3.39M to 3.4M or inflates 322.6K to 322.60K — so this mirrors the
 * original arithmetic instead.
 */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** A Raw Data window headline: 322.6K / 3.39M / 80.8. */
export function formatFieldValue(value: number | null): string {
  if (value === null) return "—";
  return compactNumber(value);
}

/**
 * A metric value, respecting its unit. Mirrors `fmtCanonicalValue`
 * (atlas-v4.1.html) — note `hours` compacts while `days` and `s` simply round.
 */
export function formatMetricValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "%":
      return `${value.toFixed(1)}%`;
    case "pp":
      return `${value.toFixed(1)} pp`;
    case "s":
      return `${Math.round(value)}s`;
    case "min":
      return `${value.toFixed(1)} min`;
    case "hours":
      return `${compactNumber(Math.round(value))} h`;
    case "days":
      return `${Math.round(value)}d`;
    default:
      if (Math.abs(value) >= 1000) return compactNumber(Math.round(value));
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
}
