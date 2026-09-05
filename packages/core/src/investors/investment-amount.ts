export function parseInvestmentAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (trimmed === "-" || trimmed === "—" || /^tbd$/i.test(trimmed) || /^n\/?a$/i.test(trimmed)) return 0;
  const compact = trimmed.replace(/,/g, "").replace(/\s+/g, "");
  const suffixMatch = compact.match(/^[$£€]?([\d.]+)([kKmM])?$/);
  if (suffixMatch) {
    const base = Number(suffixMatch[1]);
    if (!Number.isFinite(base)) return 0;
    const suffix = suffixMatch[2]?.toLowerCase();
    if (suffix === "k") return base * 1_000;
    if (suffix === "m") return base * 1_000_000;
    return base;
  }
  const digitsOnly = compact.replace(/[^0-9.-]/g, "");
  if (!digitsOnly) return 0;
  const value = Number(digitsOnly);
  return Number.isFinite(value) ? value : 0;
}
