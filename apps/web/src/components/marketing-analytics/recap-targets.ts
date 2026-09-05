import type { RecapTarget } from "@/services/marketing-recap.service";

/**
 * Editing logic for the Daily Recap's per-telco targets.
 *
 * Kept apart from the dialog because two of the rules here are the kind that
 * quietly destroy data if they are wrong, and both are far easier to pin down
 * in a test than through a dialog:
 *
 *  - The API replaces the WHOLE stored array on every PUT, so a save must
 *    carry every telco — including ones the editor never showed.
 *  - `null` and `0` are different answers. Blank means "not configured" and
 *    renders as an em dash; zero is a figure someone typed on purpose.
 */

/** One row of the editor. Numbers live as text so blank stays distinct from 0. */
export interface RecapTargetDraft {
  partnerId: string;
  label: string;
  addressableMau: string;
  targetDau: string;
  excluded: boolean;
}

export interface ParsedNumberField {
  /** `null` for a blank field — "not configured", not zero. */
  value: number | null;
  /** Set when the text is not a number this field can hold. */
  error: string | null;
}

/**
 * Read one numeric field.
 *
 * Thousands separators are accepted because these figures are millions-scale
 * and get pasted out of the deck ("10,800,000"); rejecting the paste would be
 * pedantry. Anything else is reported rather than coerced — silently turning
 * "10.8M" into 10.8 would save successfully and put a nonsense figure in front
 * of management.
 */
export function parseNumberField(text: string): ParsedNumberField {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null, error: null };

  const cleaned = trimmed.replace(/[,\s_]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return { value: null, error: `“${trimmed}” is not a number` };
  }
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: `“${trimmed}” is not a number` };
  }
  // The API takes any non-negative number, but a fractional person is not a
  // thing these columns can mean.
  return { value: Math.round(parsed), error: null };
}

/** How a number comes back out into an input: blank for null, plain digits otherwise. */
export function formatNumberField(value: number | null): string {
  return value === null ? "" : String(value);
}

export interface SeedInput {
  /** Telcos from the dashboard payload, estate key already removed. */
  accounts: { key: string; label: string }[];
  /** Whatever is stored today. */
  stored: RecapTarget[];
}

/**
 * One draft row per telco, in payload order, carrying whatever is stored.
 *
 * Seeded from every account rather than the reader's current Accounts
 * selection: targets are org-wide config, so a telco the reader has unchecked
 * still has to appear — otherwise saving would drop its stored figures purely
 * because of a view filter.
 */
export function seedDrafts({
  accounts,
  stored,
}: SeedInput): RecapTargetDraft[] {
  // First match wins, because the recap table reads its own figures with
  // `targets.find(...)`. Nothing dedupes partnerIds on the way in, so a
  // duplicated row would otherwise show one value in the table and a different
  // one in the editor supposedly editing it. Saving normalises the duplicate
  // away, since the editor emits exactly one row per account.
  const byId = new Map<string, RecapTarget>();
  for (const t of stored) {
    if (!byId.has(t.partnerId)) byId.set(t.partnerId, t);
  }
  return accounts.map((a) => {
    const t = byId.get(a.key);
    return {
      partnerId: a.key,
      label: a.label,
      addressableMau: formatNumberField(t?.addressableMau ?? null),
      targetDau: formatNumberField(t?.targetDau ?? null),
      excluded: t?.excluded ?? false,
    };
  });
}

/**
 * Stored rows for partners the payload does not mention.
 *
 * A partner can drop out of the dashboard payload without its configuration
 * becoming wrong — an override removed from the registry, a telco with no data
 * in the current window. Because the PUT replaces the whole array, anything not
 * resubmitted is deleted, so these are carried through untouched instead of
 * being quietly destroyed by an unrelated edit.
 */
export function orphanedTargets(
  accounts: { key: string }[],
  stored: RecapTarget[],
): RecapTarget[] {
  const known = new Set(accounts.map((a) => a.key));
  return stored.filter((t) => !known.has(t.partnerId));
}

export interface DraftsToTargets {
  targets: RecapTarget[];
  /** Field-level problems, keyed `<partnerId>.<field>`, for inline messages. */
  errors: Record<string, string>;
  /** True when nothing is wrong and the array is safe to send. */
  valid: boolean;
}

/**
 * Turn the editor's rows back into the array the API stores.
 *
 * `orphans` are appended verbatim — see {@link orphanedTargets}.
 *
 * A row carrying nothing at all is DROPPED rather than written as nulls. The two
 * are identical to every reader of this data (an absent row and a row of nulls
 * both render as an em dash), but writing them is not harmless: the recap decides
 * whether to show its "nothing set yet" note by testing whether the stored array
 * is empty, so a save that emitted a null row per telco would retire that note
 * permanently — including immediately after an admin cleared every figure, which
 * is exactly when it is needed. Dropping the row is also what makes clearing a
 * figure round-trip: it comes back as a blank input next time.
 *
 * `excluded` is the exception. It is a real answer even with no figures beside
 * it, so an excluded telco is always written.
 */
export function draftsToTargets(
  drafts: RecapTargetDraft[],
  orphans: RecapTarget[] = [],
): DraftsToTargets {
  const errors: Record<string, string> = {};
  const targets: RecapTarget[] = drafts.map((d) => {
    const addressable = parseNumberField(d.addressableMau);
    const target = parseNumberField(d.targetDau);
    if (addressable.error) {
      errors[`${d.partnerId}.addressableMau`] = addressable.error;
    }
    if (target.error) errors[`${d.partnerId}.targetDau`] = target.error;
    return {
      partnerId: d.partnerId,
      addressableMau: addressable.value,
      targetDau: target.value,
      excluded: d.excluded,
    };
  });
  const carries = (t: RecapTarget) =>
    t.addressableMau !== null || t.targetDau !== null || t.excluded;
  return {
    targets: [...targets.filter(carries), ...orphans],
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

/**
 * How many telcos have an addressable MAU set, for the dialog's summary line.
 *
 * Counts a stored 0 as configured — it is a figure someone entered, and the
 * point of this line is to tell an admin whether the column will read as
 * populated, not whether it is non-zero.
 */
export function configuredCount(drafts: RecapTargetDraft[]): number {
  return drafts.filter((d) => parseNumberField(d.addressableMau).value !== null)
    .length;
}
