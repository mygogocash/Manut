export type BulkBusinessUnitMode = "add" | "replace";

export function nextBusinessUnits(
  current: readonly string[],
  requested: readonly string[],
  mode: BulkBusinessUnitMode,
): string[] | null {
  const wanted = [...new Set(requested)];
  const next =
    mode === "replace"
      ? wanted
      : [...current, ...wanted.filter((code) => !current.includes(code))];
  const deduped = [...new Set(next)];
  return sameSet(current, deduped) ? null : deduped;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  for (const code of b) {
    if (!left.has(code)) return false;
  }
  return true;
}
