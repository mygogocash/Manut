/**
 * Bulk-import helpers for investors — pure, so the rules are testable without
 * a database or a mocked repository.
 *
 * These exist because `bulkCreate` did three things wrong and all three were
 * invisible from the outside:
 *
 *  1. It had no match step, so re-running an import created a second copy of
 *     every row.
 *  2. It wrapped each row in a bare `catch {}` and counted the failure as
 *     "skipped", discarding the reason — so a whole file could fail validation
 *     and report only a number.
 *  3. Rows could carry tag codes that existed on no catalog row, so the chips
 *     rendered as raw slugs in the UI and the tag filter never listed them.
 */

/** A row's identity for matching, and why it is shaped this way. */
export interface ImportIdentity {
  name: string;
  fundraisingEntity: string;
}

/**
 * Match key for an investor row.
 *
 * The firm name scoped to its fundraising vehicle. There is no natural code on
 * an investor, and the name alone is NOT the key: the same fund can legitimately
 * exist once under TBH and once under TBL, and collapsing those would have one
 * import silently overwrite the other entity's record.
 *
 * Case- and whitespace-insensitive, because a hand-maintained sheet is careless
 * about both — "Jungle  Ventures" and "jungle ventures" are the same firm.
 */
export function investorMatchKey(
  name: string | null | undefined,
  fundraisingEntity: string | null | undefined,
): string | null {
  const n = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const e = (fundraisingEntity ?? "").trim().toLowerCase();
  if (!n || !e) return null;
  return `${e}|${n}`;
}

/**
 * Canonical form of a LinkedIn profile URL, or null if it is not one.
 *
 * The same person appears as `sg.linkedin.com/in/x`, `hk.linkedin.com/in/x` and
 * `www.linkedin.com/in/x` across a hand-built sheet — the country subdomain is
 * whichever geography the researcher was browsing from, not part of the
 * identity. Trailing slashes and tracking query strings vary too.
 *
 * A `/search/results/` URL is deliberately NOT a profile: it identifies a query,
 * not a person, and several placeholder rows can share one. Treating it as an
 * identity would merge unrelated people.
 */
export function normaliseLinkedIn(
  url: string | null | undefined,
): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  const m = /linkedin\.com\/in\/([^/?#\s]+)/i.exec(raw);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]!).toLowerCase();
  return slug ? `linkedin.com/in/${slug}` : null;
}

/**
 * The identity an import row is matched on.
 *
 * A LinkedIn profile WINS outright when present. This is load-bearing: a lead
 * list carries many people at one firm, so with `name` holding the company the
 * (name, entity) key made every lead after the first look like a duplicate —
 * empirically 10 Jungle leads became 1 insert and 9 skips. The profile URL is
 * the actual per-person identity, and it is also what Expandi keys on.
 *
 * Only a row with no profile URL falls back to (name, entity), which stays
 * right for fund-level rows where the name IS the record.
 */
export function investorIdentity(row: {
  name?: string | null;
  fundraisingEntity?: string | null;
  linkedinUrl?: string | null;
}): { kind: "linkedin" | "name"; key: string } | null {
  const li = normaliseLinkedIn(row.linkedinUrl);
  if (li) return { kind: "linkedin", key: `li|${li}` };
  const byName = investorMatchKey(row.name, row.fundraisingEntity);
  return byName ? { kind: "name", key: `nm|${byName}` } : null;
}

/**
 * Fields an UPDATE is allowed to write, given what the row actually carried.
 *
 * An import row is a partial view of an investor: a decision-maker sheet has a
 * name, a contact and a LinkedIn URL, and knows nothing about the pipeline
 * stage, the investment amounts or the notes somebody has since written. The
 * create payload fills every column, so reusing it for an update wrote null
 * over all of that.
 *
 * So a null/undefined/empty value means "this sheet has no opinion" and is
 * dropped. Clearing a field stays a UI action, never an import side effect.
 *
 * `tags` is the deliberate exception: it MERGES rather than replaces, because
 * two different sheets legitimately tag the same firm (a fund can be both
 * `jungle-ventures` and `seed-investors`) and the second import must not strip
 * the first one's tag.
 */
export function sparseInvestorUpdate(
  row: Record<string, unknown>,
  existingTags: string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "tags") continue;
    if (key === "fundraisingEntity") continue; // part of the key; never moved
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  const incoming = Array.isArray(row.tags) ? (row.tags as string[]) : [];
  if (incoming.length > 0) {
    out.tags = [...new Set([...existingTags, ...incoming])].sort();
  }
  return out;
}

/**
 * Turn a tag code into a human label for a catalog row we are creating.
 *
 * Only used when the importer has to invent the catalog entry: the code is the
 * machine value the rows already carry, so the label is cosmetic and can be
 * corrected in Manage tags afterwards. Prettified rather than left as a slug
 * because a raw `golden-gate-ventures` in the filter dropdown reads as a bug.
 */
export function labelForTagCode(code: string): string {
  return code
    .split("-")
    .filter(Boolean)
    .map((part) =>
      /^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

/** Distinct tag codes across the payload, in stable order. */
export function collectTagCodes(
  rows: Array<{ tags?: string[] | undefined }>,
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const code of row.tags ?? []) {
      const trimmed = code.trim();
      if (trimmed) seen.add(trimmed);
    }
  }
  return [...seen].sort();
}

export interface ImportRowPlan {
  /** 1-based row number, so it matches what the user sees in the sheet. */
  row: number;
  name: string;
  fundraisingEntity: string;
  action: "insert" | "update";
  matchedId: string | null;
  tags: string[];
  errors: string[];
}

/**
 * Decide insert-vs-update for every row, before anything is written.
 *
 * `seen` makes two rows sharing a key inside ONE file behave correctly: the
 * first matches an existing record, the second must NOT also update it — that
 * would silently apply two different rows to one record and lose the first.
 * The duplicate is reported instead.
 */
export function planImport(
  rows: Array<{
    name: string;
    fundraisingEntity: string;
    linkedinUrl?: string | null;
    tags?: string[] | undefined;
  }>,
  existingByKey: Map<string, string>,
): ImportRowPlan[] {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const identity = investorIdentity(row);
    const errors: string[] = [];
    let action: "insert" | "update" = "insert";
    let matchedId: string | null = null;

    if (!identity) {
      errors.push(
        "No LinkedIn profile and no name + fundraising entity — cannot be matched",
      );
    } else if (seen.has(identity.key)) {
      errors.push(
        identity.kind === "linkedin"
          ? `Duplicate LinkedIn profile earlier in this file (${row.name}) — skipped so the first row's values survive`
          : `Duplicate of an earlier row in this file (${row.name}) — skipped so the first row's values survive`,
      );
    } else {
      seen.add(identity.key);
      const hit = existingByKey.get(identity.key);
      if (hit) {
        action = "update";
        matchedId = hit;
      }
    }

    return {
      row: index + 1,
      name: row.name,
      fundraisingEntity: row.fundraisingEntity,
      action,
      matchedId,
      tags: row.tags ?? [],
      errors,
    };
  });
}
