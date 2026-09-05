// Identity matching for merging two contacts that have no tax ID between them.
//
// A tax ID is the only identifier that is unique by construction. Without one,
// a merge is a judgement call, and the cost of getting it wrong is high and
// irreversible: the two parties' balances pool, and so does their withholding
// tax, so the WHT certificates and the PND3 already filed stop matching the
// real payee.
//
// So the rule is corroboration — at least two independent identifiers must
// agree before the merge screen will even open.
//
// NOTE ON THE PRD: PRD 9.5 names the three identifiers as bank account number,
// name, and phone-or-address. `vendors` has no bank-account column, so that
// component cannot be scored. The third slot here is the address instead.
// Adding an empty column would not help — it would be null on every existing
// contact and could never contribute to a score. Raised with the PRD authors.

export type IdentityComponent = "name" | "contact" | "address";

export interface ContactIdentityInput {
  name?: string | null;
  nameTh?: string | null;
  phone?: string | null;
  mobile?: string | null;
  addressTh?: string | null;
  addressEn?: string | null;
  zipCode?: string | null;
  businessType?: string | null;
  branchCode?: string | null;
}

export interface IdentityMatch {
  component: IdentityComponent;
  matched: boolean;
  /** Why, in words the merge screen can show next to the component. */
  detail: string;
}

export interface IdentityScore {
  score: number;
  required: number;
  matches: IdentityMatch[];
  sufficient: boolean;
}

/** Lower-cased, whitespace-collapsed, punctuation-light. Enough to see through
 *  "บ.เอบีซี จำกัด" vs "บริษัท เอบีซี จำกัด" spacing differences, not enough to
 *  call two genuinely different names the same. */
function norm(value: string | null | undefined): string {
  return (
    (value ?? "")
      .trim()
      .toLowerCase()
      // Punctuation becomes a SPACE, not nothing: an abbreviation mark often
      // stands in for the separator itself, so "บ.เอบีซี" and "บ. เอบีซี" are the
      // same name written two ways. Deleting the dot instead would leave those two
      // strings different and quietly cost the name its match.
      .replace(/[.\-_,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Digits only, so 08x-xxx-1234 and 08xxxx1234 compare equal. */
function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function anyEqual(a: string[], b: string[]): boolean {
  const left = a.filter(Boolean);
  const right = b.filter(Boolean);
  return left.some((x) => right.includes(x));
}

export const IDENTITY_MATCHES_REQUIRED = 2;

/**
 * Score two contacts against each other.
 *
 * Each component counts once. A component where BOTH sides are blank does not
 * count as agreement — two contacts with no phone number recorded have not
 * corroborated anything, and treating absence as a match is how unrelated
 * contacts would sail through.
 */
export function scoreContactIdentity(
  a: ContactIdentityInput,
  b: ContactIdentityInput,
): IdentityScore {
  const matches: IdentityMatch[] = [];

  const nameMatched = anyEqual(
    [norm(a.name), norm(a.nameTh)],
    [norm(b.name), norm(b.nameTh)],
  );
  matches.push({
    component: "name",
    matched: nameMatched,
    detail: nameMatched
      ? "Name matches"
      : "Names differ once case and spacing are ignored",
  });

  const contactMatched = anyEqual(
    [digits(a.phone), digits(a.mobile)],
    [digits(b.phone), digits(b.mobile)],
  );
  matches.push({
    component: "contact",
    matched: contactMatched,
    detail: contactMatched
      ? "Phone number matches"
      : "No shared phone number on record",
  });

  const addressMatched = anyEqual(
    [norm(a.addressTh), norm(a.addressEn), norm(a.zipCode)],
    [norm(b.addressTh), norm(b.addressEn), norm(b.zipCode)],
  );
  matches.push({
    component: "address",
    matched: addressMatched,
    detail: addressMatched ? "Address matches" : "No shared address on record",
  });

  const score = matches.filter((m) => m.matched).length;
  return {
    score,
    required: IDENTITY_MATCHES_REQUIRED,
    matches,
    sufficient: score >= IDENTITY_MATCHES_REQUIRED,
  };
}

/**
 * An individual and a juristic person are never the same payee, whatever else
 * agrees. They are withheld against under different rules and reported on
 * different returns, so pooling them corrupts filings that have already gone in.
 */
export function isIncompatibleBusinessType(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  const individual = (v: string) =>
    v.includes("individual") || v.includes("บุคคล");
  return individual(left) !== individual(right);
}

/**
 * Two branches of one juristic person keep separate registrations, because a
 * tax invoice must name the branch it was issued to. Same tax ID is therefore
 * NOT sufficient — the branch code has to agree as well.
 */
export function isBranchMismatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  // Blank on both sides means neither is a branch; blank on one is treated as
  // head office, which is what the field's absence means in practice.
  const left = norm(a) || "00000";
  const right = norm(b) || "00000";
  return left !== right;
}
