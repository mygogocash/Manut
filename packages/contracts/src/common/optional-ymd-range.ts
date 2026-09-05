/**
 * For optional YYYY-MM-DD fields: when both are non-empty, end must be >= start
 * (lexicographic order matches chronological order for ISO dates).
 */
export function isValidOptionalYmdRange(
  start: string | undefined,
  end: string | undefined,
): boolean {
  const s = start?.trim();
  const e = end?.trim();
  if (!s || !e) return true;
  return e >= s;
}
