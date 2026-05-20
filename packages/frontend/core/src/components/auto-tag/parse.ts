/**
 * Shared SSE-stream-object defense + tag/string-list parser.
 *
 * The copilot `/chat/:id/stream-object` endpoint emits SSE events whose
 * `data` payloads are JSON-stringified `StreamObject` chunks
 * (e.g. `{"type":"text-delta","textDelta":"..."}`), NOT raw text. The
 * `textToText({stream: false})` helper already strips these in
 * `blocksuite/ai/provider/request.ts`, but defense-in-depth at the
 * parse boundary is mandatory — v1.10.1 shipped tags rendered as
 * `{"type":"text-delta","textDelta":"…"}` to production because a
 * single rogue chunk slipped past the join layer.
 *
 * CLAUDE.md §6c documents the full trap.
 *
 * Public surface:
 *   - `parseTagCandidates(raw)` — JSON-array → array-extract → line-split
 *     fallback chain. Returns string[] (possibly empty, never throws).
 *   - `looksLikeSseFragment(candidate)` — rejecter for individual
 *     candidates that contain SSE structural fragments. Should be applied
 *     AFTER `parseTagCandidates` as a final filter.
 *
 * NOTE: this used to live in `workspace-property-types/tags.tsx`. It is
 * extracted here so both the manual AI Auto Tag button and the new
 * auto-tag-on-save flow share one defense.
 */

// A candidate is treated as garbage if it contains any structural
// fragment from the underlying SSE stream-object payload, e.g. the JSON
// wrappers around text-delta chunks. We reject conservatively; false
// positives (a tag containing a literal brace or backslash) are far
// less harmful than a wall of stream chunks rendered as tags.
const SSE_FRAGMENT_PATTERNS: RegExp[] = [
  /\{/,
  /\}/,
  /[\\]/,
  /"type"\s*:/i,
  /"textDelta"\s*:/i,
  /text-delta/i,
  /text_delta/i,
  /finishReason/i,
  /:\s*"/,
];

export function looksLikeSseFragment(candidate: string): boolean {
  if (!candidate) return true;
  if (/^[\s\\"'`]*$/.test(candidate)) return true;
  return SSE_FRAGMENT_PATTERNS.some(re => re.test(candidate));
}

// Strip stray escaped quotes / whitespace that survive JSON.parse on
// imperfect inputs. A name like \"mind\" becomes mind.
function trimQuoteArtifacts(s: string): string {
  return s
    .trim()
    .replace(/^[\s"'`\\]+/, '')
    .replace(/[\s"'`\\]+$/, '')
    .trim();
}

// Pull string candidates out of an AI response that should be a JSON
// array of strings but might be: (a) a clean array, (b) array embedded
// in prose, (c) prose with newlines or commas between entries, (d) raw
// SSE chunks concatenated together. Try strategies in increasing
// aggressiveness.
export function parseTagCandidates(raw: string): string[] {
  // Strategy 0: defensive pre-strip. Remove obvious SSE chunk wrappers
  // before JSON.parse so a single rogue chunk does not poison the whole
  // array.
  const cleaned = raw
    .replace(/\{"type"\s*:\s*"text-delta"\s*,\s*"textDelta"\s*:\s*"/g, '')
    .replace(/\{"type"\s*:\s*"finish"[^}]*\}/g, '')
    .replace(/\{"type"\s*:\s*"[^"]*"\s*,\s*"textDelta"\s*:\s*"/g, '');

  const tryParseArray = (text: string): string[] | null => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(x => trimQuoteArtifacts(String(x)));
      }
    } catch {
      // fall through
    }
    return null;
  };

  // Strategy 1: full JSON parse on cleaned text.
  const direct = tryParseArray(cleaned);
  if (direct && direct.length > 0) return direct;

  // Strategy 2: extract first JSON array literal substring.
  const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    const fromMatch = tryParseArray(arrayMatch[0]);
    if (fromMatch && fromMatch.length > 0) return fromMatch;
  }

  // Strategy 3: split on newlines or commas. Strip bullet/quote prefixes.
  const linesplit = cleaned
    .split(/\r?\n|,/)
    .map(s => trimQuoteArtifacts(s.replace(/^[\s\-*•]+/, '')))
    .filter(s => s.length > 0);
  if (linesplit.length > 0) return linesplit;

  return [];
}

/**
 * One-shot cleanup pipeline used by both the manual AI Auto Tag button
 * and the auto-on-save flow. Applies `parseTagCandidates` then filters
 * out SSE fragments + length-bounds + dedupes.
 */
export function cleanTagSuggestions(raw: string, max = 7): string[] {
  const suggested = parseTagCandidates(raw);
  return Array.from(
    new Set(
      suggested
        .map(s => String(s).trim().toLowerCase())
        .filter(s => s.length >= 2 && s.length <= 40)
        .filter(s => !looksLikeSseFragment(s))
    )
  ).slice(0, max);
}
