import { BadRequestException } from "@/common/exceptions/http-exception";
import {
  type IdentityScore,
  isBranchMismatch,
  isIncompatibleBusinessType,
} from "@/modules/accounting/contact-identity";
import { roundMoney } from "@/modules/accounting/rounding";

export const VENDOR_MERGE_FIELDS = [
  "name",
  "nameTh",
  "nameEn",
  "contactId",
  "contactType",
  "businessType",
  "businessLocation",
  "addressTh",
  "addressEn",
  "address2",
  "address3",
  "deliveryAddressTh",
  "deliveryAddressEn",
  "zipCode",
  "taxId",
  "branchCode",
  "branch",
  "contactName",
  "email",
  "mobile",
  "phone",
  "faxNumber",
  "creditDays",
  "paymentTerms",
  "defaultCurrency",
  "taxTreatment",
  "defaultRevenueAccountId",
  "defaultExpenseAccountId",
  "defaultWhtRate",
  "creditLimit",
  "notes",
] as const;

export type VendorMergeField = (typeof VENDOR_MERGE_FIELDS)[number];
export type VendorFieldKeep = "surviving" | "source";
export type VendorKeepMap = Partial<Record<VendorMergeField, VendorFieldKeep>>;

// A merge only ever REPOINTS documents, so every balance must survive it to the
// satang. `side` names which control account drifted ("receivable" / "payable")
// because the two are checked separately: netting a customer balance against a
// supplier balance would hide a drift on one side behind the other, and AR and
// AP are different control accounts that must each tie to the trial balance.
export function assertMergeOutstandingUnchanged(
  before: number,
  after: number,
  side?: string,
): void {
  if (roundMoney(before) !== roundMoney(after)) {
    const what = side ? `${side} outstanding` : "outstanding";
    throw new BadRequestException(
      `Vendor merge rolled back: ${what} ${roundMoney(before)} became ${roundMoney(after)}`,
    );
  }
}

export function applyVendorKeepFields<T extends Record<string, unknown>>(
  surviving: T,
  source: T,
  keep: VendorKeepMap,
): Partial<T> {
  const patch: Partial<T> = {};
  for (const field of VENDOR_MERGE_FIELDS) {
    if (keep[field] !== "source") continue;
    patch[field as keyof T] = source[field] as T[keyof T];
  }
  return patch;
}

export function vendorFieldDiffs(
  surviving: Record<string, unknown>,
  source: Record<string, unknown>,
): Array<{
  field: VendorMergeField;
  surviving: unknown;
  source: unknown;
  different: boolean;
}> {
  return VENDOR_MERGE_FIELDS.map((field) => {
    const a = surviving[field] ?? null;
    const b = source[field] ?? null;
    return {
      field,
      surviving: a,
      source: b,
      different: String(a ?? "") !== String(b ?? ""),
    };
  });
}

export function groupVendorDuplicateSuggestions<
  T extends { id: string; name: string; taxId?: string | null },
>(vendors: T[]): T[][] {
  const byTax = new Map<string, T[]>();
  const noTaxByName = new Map<string, T[]>();
  for (const vendor of vendors) {
    const tax = vendor.taxId?.trim();
    if (tax) {
      const list = byTax.get(tax) ?? [];
      list.push(vendor);
      byTax.set(tax, list);
      continue;
    }
    const key = vendor.name.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key) continue;
    const list = noTaxByName.get(key) ?? [];
    list.push(vendor);
    noTaxByName.set(key, list);
  }
  return [...byTax.values(), ...noTaxByName.values()].filter(
    (group) => group.length > 1,
  );
}

export interface DuplicatePaymentCandidate {
  id: string;
  date: string;
  amount: number;
  reference: string | null;
  invoiceNo: string;
}

export function scanDuplicatePaymentsAfterMerge(
  payments: DuplicatePaymentCandidate[],
): DuplicatePaymentCandidate[][] {
  const byKey = new Map<string, DuplicatePaymentCandidate[]>();
  for (const payment of payments) {
    const ref = payment.reference?.trim().toLowerCase() ?? "";
    const key = ref
      ? `ref:${ref}`
      : `amt:${payment.date}:${roundMoney(payment.amount).toFixed(2)}`;
    const list = byKey.get(key) ?? [];
    list.push(payment);
    byKey.set(key, list);
  }
  return [...byKey.values()].filter((group) => group.length > 1);
}

// Two contacts that BOTH carry a tax ID and disagree are two different legal
// entities. Merging them pools their payable balances AND their withholding-tax
// history, so the WHT certificates and the ภ.ง.ด.3 already filed under each name
// stop matching the real payee — and a merge cannot be undone. No reason text
// makes that safe, so this case has NO escape hatch: correct the data, or leave
// the two contacts separate.
//
// A MISSING tax ID is the case `missingTaxIdReason` exists for (an individual
// sub-contractor with no VAT registration). That merge is allowed, warns, and
// records why.
/**
 * The whole gate for a merge, in one place, so the preview screen and the merge
 * itself can never disagree about what is allowed.
 *
 * Order matters. A branch mismatch and an individual-vs-juristic mismatch are
 * absolute: no amount of corroboration makes them the same payee. Only after
 * those pass does a missing tax ID fall back to identity scoring.
 */
export function assertContactMergeAllowed(opts: {
  survivingTaxId?: string | null;
  sourceTaxId?: string | null;
  survivingBranchCode?: string | null;
  sourceBranchCode?: string | null;
  survivingBusinessType?: string | null;
  sourceBusinessType?: string | null;
  identity: IdentityScore;
  missingTaxIdReason?: string | null;
  acknowledgedSameParty?: boolean;
}): { warning?: string; mergedWithoutTaxId: boolean } {
  if (
    isIncompatibleBusinessType(
      opts.survivingBusinessType,
      opts.sourceBusinessType,
    )
  ) {
    throw new BadRequestException(
      "One of these is an individual and the other a juristic person. They are " +
        "withheld against under different rules and reported on different " +
        "returns, so they cannot be merged.",
    );
  }

  const a = opts.survivingTaxId?.trim() ?? "";
  const b = opts.sourceTaxId?.trim() ?? "";

  if (a && b) {
    if (a !== b) {
      throw new BadRequestException(
        `Tax IDs differ (${a} vs ${b}); these are different legal entities and cannot be merged`,
      );
    }
    // Same juristic person, but a tax invoice has to name the branch it was
    // issued to, so two branches stay two contacts.
    if (isBranchMismatch(opts.survivingBranchCode, opts.sourceBranchCode)) {
      throw new BadRequestException(
        "Same tax ID but different branch codes. A tax invoice must name the " +
          "branch, so keep these as separate contacts.",
      );
    }
    return { mergedWithoutTaxId: false };
  }

  // No tax ID on at least one side: corroboration required.
  if (!opts.identity.sufficient) {
    const missing = opts.identity.matches
      .filter((m) => !m.matched)
      .map((m) => m.detail)
      .join("; ");
    throw new BadRequestException(
      `Without a tax ID, at least ${opts.identity.required} identifiers must ` +
        `agree before these can be merged. Only ${opts.identity.score} does. ${missing}`,
    );
  }
  if (!opts.missingTaxIdReason?.trim()) {
    throw new BadRequestException("A missing tax ID requires a reason");
  }
  if (!opts.acknowledgedSameParty) {
    throw new BadRequestException(
      "Confirm you have checked these are the same party. A merge cannot be undone.",
    );
  }
  return {
    warning: "Merged without a tax ID",
    mergedWithoutTaxId: true,
  };
}

export function assertVendorTaxIdMergeAllowed(opts: {
  survivingTaxId?: string | null;
  sourceTaxId?: string | null;
  missingTaxIdReason?: string | null;
}): { warning?: string } {
  const a = opts.survivingTaxId?.trim() ?? "";
  const b = opts.sourceTaxId?.trim() ?? "";
  if (a && b && a !== b) {
    throw new BadRequestException(
      `Tax IDs differ (${a} vs ${b}); these are different legal entities and cannot be merged`,
    );
  }
  if (!a || !b) {
    if (!opts.missingTaxIdReason?.trim()) {
      throw new BadRequestException(
        "A missing tax ID requires missingTaxIdReason",
      );
    }
    return { warning: "Merging vendors with a missing tax ID" };
  }
  return {};
}
