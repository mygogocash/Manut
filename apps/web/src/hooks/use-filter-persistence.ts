"use client";

/**
 * Remembering a dashboard's applied filters between visits.
 *
 * Two layers, because they answer different questions:
 *
 *  - The URL query string (`?from=…&to=…&accounts=…`), so a reload lands on the
 *    same view and the view can be pasted to someone else. Written with
 *    `history.replaceState` for the same reasons `useTabParam` gives: no
 *    `<Suspense>` requirement, no navigation, and no back-button pollution.
 *  - localStorage, so arriving fresh from the sidebar — no query string at all —
 *    still continues from wherever the reader left off.
 *
 * The URL wins when both are present: it is the more specific instruction, and
 * it is the one a shared link carries.
 *
 * Only APPLIED state is ever persisted, never a draft. Restoring a draft would
 * put the page back into a half-expressed filter nobody had asked for, and on
 * these dashboards each apply is a 120-day BNII query.
 *
 * A default value persists as ABSENCE — an empty range or an unnarrowed account
 * list clears its keys rather than writing "everything". That keeps a clean URL
 * clean, and it means Reset genuinely resets instead of being undone on the next
 * visit by a stored value that says the same thing the default already says.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Storage and the URL are both best-effort: neither is worth a crash. */
function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key) ?? null;
  } catch {
    // Private browsing, a full quota, a blocked origin — treat as "nothing
    // remembered" rather than taking the page down over a convenience.
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // As above.
  }
}

function readUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(key);
  return value && value.length > 0 ? value : null;
}

/** Set or delete several query params in one replaceState. */
function writeUrlParams(next: Record<string, string | null>): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(next)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}

// ── Date range ──────────────────────────────────────────────────

export interface PersistedRange {
  from: string;
  to: string;
}

/**
 * A stored or shared range, or null when there is nothing usable.
 *
 * Each side is validated independently and a bad one is dropped rather than
 * failing the pair: `?from=2026-08-01&to=lol` should still honour the FROM the
 * reader can see worked, not silently ignore both. A shape the API would reject
 * never reaches it — the query string is hand-editable, and this is where a
 * typo stops.
 */
export function parseRange(
  rawFrom: string | null,
  rawTo: string | null,
): PersistedRange | null {
  const from = rawFrom && YMD.test(rawFrom) ? rawFrom : "";
  const to = rawTo && YMD.test(rawTo) ? rawTo : "";
  if (!from && !to) return null;
  // A backwards range is the one combination that produces an empty dataset
  // with no obvious cause, so it is refused as a pair.
  if (from && to && from > to) return null;
  return { from, to };
}

/** Parse the JSON blob localStorage holds for a range. */
export function parseStoredRange(raw: string | null): PersistedRange | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    return parseRange(
      typeof v.from === "string" ? v.from : null,
      typeof v.to === "string" ? v.to : null,
    );
  } catch {
    return null;
  }
}

/** URL first, then storage. */
export function readPersistedRange(
  storageKey: string,
  fromParam = "from",
  toParam = "to",
): PersistedRange | null {
  return (
    parseRange(readUrlParam(fromParam), readUrlParam(toParam)) ??
    parseStoredRange(readStored(storageKey))
  );
}

export function persistRange(
  storageKey: string,
  range: PersistedRange,
  fromParam = "from",
  toParam = "to",
): void {
  const empty = !range.from && !range.to;
  writeStored(storageKey, empty ? null : JSON.stringify(range));
  writeUrlParams({
    [fromParam]: range.from || null,
    [toParam]: range.to || null,
  });
}

// ── Account selection ───────────────────────────────────────────

/**
 * Which accounts were applied, or null for "every account".
 *
 * Null is both the default and a legitimate applied answer, and the two are
 * indistinguishable in effect, so "all" is stored as absence. That avoids a
 * third state nobody would benefit from telling apart.
 *
 * An empty list decodes to null: the API rejects an explicitly empty selection,
 * and a hand-emptied `?accounts=` should land on the default rather than a 400.
 */
export function parseAccounts(raw: string | null): string[] | null {
  if (!raw) return null;
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  return keys.length > 0 ? keys : null;
}

/** URL first, then storage. */
export function readPersistedAccounts(
  storageKey: string,
  param = "accounts",
): string[] | null {
  return (
    parseAccounts(readUrlParam(param)) ?? parseAccounts(readStored(storageKey))
  );
}

export function persistAccounts(
  storageKey: string,
  accounts: string[] | null,
  param = "accounts",
): void {
  const encoded = accounts && accounts.length > 0 ? accounts.join(",") : null;
  writeStored(storageKey, encoded);
  writeUrlParams({ [param]: encoded });
}
