/**
 * Parse an imported "Business Units" spreadsheet cell into unit codes.
 *
 * The Accounts export writes codes, so an export → edit → import round trip
 * is exact. A human editing the sheet is far more likely to type the labels
 * they see on screen, so those resolve too (case-insensitively).
 *
 * Unresolvable tokens are RETURNED rather than dropped: a silent drop is
 * exactly how a tag disappears without anyone noticing, which is the whole
 * failure this feature exists to prevent.
 */
export interface BusinessUnitOptionLike {
  code: string;
  label: string;
}

export interface ParsedBusinessUnitCell {
  codes: string[];
  unknown: string[];
}

export function parseBusinessUnitCell(
  cell: string | undefined,
  known: BusinessUnitOptionLike[],
): ParsedBusinessUnitCell {
  const tokens = (cell ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const codes: string[] = [];
  const unknown: string[] = [];

  for (const token of tokens) {
    const match =
      known.find((u) => u.code === token) ??
      known.find((u) => u.code.toLowerCase() === token.toLowerCase()) ??
      known.find((u) => u.label.toLowerCase() === token.toLowerCase());
    if (match) {
      // First mention wins, so a duplicated cell doesn't produce a duplicated
      // tag — and selection order stays meaningful for the chip row.
      if (!codes.includes(match.code)) codes.push(match.code);
    } else {
      unknown.push(token);
    }
  }

  return { codes, unknown };
}
