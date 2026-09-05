/**
 * Parsing for the drift-alert recipient box.
 *
 * People paste address lists out of mail clients and spreadsheets, so the
 * separator is whatever they happened to have — newlines, commas, semicolons,
 * or spaces. Splitting on all of them is friendlier than rejecting the paste.
 *
 * Invalid entries are RETURNED rather than dropped. Silently discarding a
 * typo'd address would save successfully and leave someone quietly off an
 * alert list they believe they are on — the exact failure the drift check
 * exists to avoid, reproduced in its own settings dialog.
 */
export interface ParsedRecipients {
  valid: string[];
  invalid: string[];
}

// Deliberately permissive: the server validates with zod, and this only has to
// catch what a person can see is wrong. Anything stricter starts rejecting
// legitimate addresses (plus-tags, long TLDs, subdomains).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipients(text: string): ParsedRecipients {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const raw of text.split(/[\s,;]+/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const lower = entry.toLowerCase();
    if (!EMAIL.test(lower)) {
      // Report the original casing — it is what the user typed and has to
      // recognise in the error.
      if (!invalid.includes(entry)) invalid.push(entry);
      continue;
    }
    // Lower-case + dedupe here as well as on the server, so the count shown
    // beside the box matches what will actually be saved.
    if (seen.has(lower)) continue;
    seen.add(lower);
    valid.push(lower);
  }

  return { valid, invalid };
}
