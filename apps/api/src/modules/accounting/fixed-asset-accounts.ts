/**
 * Fixed Asset → GL account routing (Phase 2 foundations).
 *
 * Answers one question: "which ChartOfAccount does this posting line hit?"
 * Two levels, most specific first:
 *
 *   1. the FixedAssetCategory's own *GlAccountId column, when set
 *   2. the entity-level AccountMapping role (fa_asset_cost, fa_* …)
 *
 * …and a hard throw when neither is configured. Posting must never silently
 * pick a wrong account, and — more dangerously — must never silently SKIP a
 * category: a run that quietly omits an unmapped category understates
 * depreciation behind a green "posted" badge, which reconciles to nothing and
 * looks fine. `assertFixedAssetAccountsConfigured` exists so a run can refuse
 * up front, as a whole, before it writes anything.
 *
 * Every workstream that posts (depreciation, disposal, impairment, transfer)
 * routes through here. If each invented its own resolution the three postings
 * would disagree about which account a category maps to and nothing would error.
 */

import type { Prisma } from "@nexora/database";

import { BadRequestException } from "@/common/exceptions/http-exception";
import {
  AccountMappingMissingError,
  type MappingRole,
  resolveMappedAccount,
} from "@/modules/accounting/gl-posting.service";

/** The account slots a fixed-asset posting can need. */
export type FixedAssetAccountRole =
  | "assetCost"
  | "depreciationExpense"
  | "accumulatedDepreciation"
  | "disposalGain"
  | "disposalLoss";

/** The per-category override columns, in the same shape Prisma returns. */
export interface FixedAssetCategoryAccounts {
  code: string;
  assetGlAccountId: string | null;
  depreciationGlAccountId: string | null;
  accumulatedDepreciationGlAccountId: string | null;
  disposalGainGlAccountId: string | null;
  disposalLossGlAccountId: string | null;
}

/** Role → the entity-level AccountMapping role it falls back to. */
const ENTITY_ROLE: Record<FixedAssetAccountRole, MappingRole> = {
  assetCost: "fa_asset_cost",
  depreciationExpense: "fa_depreciation_expense",
  accumulatedDepreciation: "fa_accumulated_depreciation",
  disposalGain: "fa_disposal_gain",
  disposalLoss: "fa_disposal_loss",
};

/** Human label used in errors — the accountant sees these, not the enum. */
const ROLE_LABEL: Record<FixedAssetAccountRole, string> = {
  assetCost: "Asset cost",
  depreciationExpense: "Depreciation expense",
  accumulatedDepreciation: "Accumulated depreciation",
  disposalGain: "Gain on disposal",
  disposalLoss: "Loss on disposal",
};

/**
 * The category's own override for a role, or null to fall through to the
 * entity mapping. Pure — no DB — so the precedence rule is unit-testable.
 */
export function pickCategoryAccount(
  category: FixedAssetCategoryAccounts,
  role: FixedAssetAccountRole,
): string | null {
  switch (role) {
    case "assetCost":
      return category.assetGlAccountId;
    case "depreciationExpense":
      return category.depreciationGlAccountId;
    case "accumulatedDepreciation":
      return category.accumulatedDepreciationGlAccountId;
    case "disposalGain":
      return category.disposalGainGlAccountId;
    case "disposalLoss":
      return category.disposalLossGlAccountId;
  }
}

/**
 * Resolve one account. Category override wins; otherwise the entity role;
 * otherwise throw naming BOTH the category and the role, because "no GL account
 * is mapped for role fa_disposal_loss" alone does not tell an accountant which
 * of twelve categories to fix.
 */
export async function resolveFixedAssetAccount(
  tx: Prisma.TransactionClient,
  entityId: string,
  category: FixedAssetCategoryAccounts,
  role: FixedAssetAccountRole,
): Promise<string> {
  const override = pickCategoryAccount(category, role);
  if (override) return override;
  try {
    return await resolveMappedAccount(tx, entityId, ENTITY_ROLE[role]);
  } catch (err) {
    if (err instanceof AccountMappingMissingError) {
      throw new BadRequestException(
        `No ${ROLE_LABEL[role]} account for asset category "${category.code}". ` +
          `Set it on the category, or map the entity-level ` +
          `"${ENTITY_ROLE[role]}" role under Accounting → Setup → Account mapping.`,
      );
    }
    throw err;
  }
}

/**
 * Preflight for a whole posting run: resolve every (category, role) pair and
 * report ALL failures at once.
 *
 * Fail-closed and fail-whole. Checking lazily inside the posting loop would
 * either abort mid-run (leaving the accountant to fix one category, re-run, and
 * hit the next) or — far worse, if the loop swallowed it — post a partial
 * journal whose total silently disagrees with the register.
 */
export async function assertFixedAssetAccountsConfigured(
  tx: Prisma.TransactionClient,
  entityId: string,
  categories: readonly FixedAssetCategoryAccounts[],
  roles: readonly FixedAssetAccountRole[],
): Promise<Map<string, Record<string, string>>> {
  const resolved = new Map<string, Record<string, string>>();
  const problems: string[] = [];

  for (const category of categories) {
    const perRole: Record<string, string> = {};
    for (const role of roles) {
      try {
        perRole[role] = await resolveFixedAssetAccount(
          tx,
          entityId,
          category,
          role,
        );
      } catch (err) {
        problems.push(
          err instanceof BadRequestException
            ? err.message
            : `${category.code}: could not resolve ${ROLE_LABEL[role]}`,
        );
      }
    }
    resolved.set(category.code, perRole);
  }

  if (problems.length > 0) {
    throw new BadRequestException(
      `Cannot post — ${problems.length} unmapped fixed-asset account(s):\n` +
        problems.join("\n"),
    );
  }
  return resolved;
}

/** Roles a monthly depreciation run needs. */
export const DEPRECIATION_ROLES = [
  "depreciationExpense",
  "accumulatedDepreciation",
] as const satisfies readonly FixedAssetAccountRole[];

/**
 * Roles a disposal or write-off needs. Both gain and loss are required even
 * though one entry uses only one of them — which it is depends on the proceeds,
 * so an entity that can only resolve the gain account would fail on the first
 * loss-making disposal, mid-approval.
 */
export const DISPOSAL_ROLES = [
  "assetCost",
  "accumulatedDepreciation",
  "disposalGain",
  "disposalLoss",
] as const satisfies readonly FixedAssetAccountRole[];
