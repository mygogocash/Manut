import type { Prisma } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import {
  assertFixedAssetAccountsConfigured,
  DEPRECIATION_ROLES,
  DISPOSAL_ROLES,
  type FixedAssetCategoryAccounts,
  pickCategoryAccount,
  resolveFixedAssetAccount,
} from "./fixed-asset-accounts";

const BARE: FixedAssetCategoryAccounts = {
  code: "IT",
  assetGlAccountId: null,
  depreciationGlAccountId: null,
  accumulatedDepreciationGlAccountId: null,
  disposalGainGlAccountId: null,
  disposalLossGlAccountId: null,
};

/** Minimal tx double: only accountMapping.findUnique is reached. */
function txWithMappings(map: Record<string, string>) {
  return {
    accountMapping: {
      findUnique: vi.fn(
        ({ where }: { where: { entityId_role: { role: string } } }) => {
          const role = where.entityId_role.role;
          return Promise.resolve(
            map[role] ? { chartOfAccountId: map[role] } : null,
          );
        },
      ),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("fixed asset accounts — category override precedence (pure)", () => {
  it("maps each role to its own column", () => {
    const full: FixedAssetCategoryAccounts = {
      code: "IT",
      assetGlAccountId: "cost-1",
      depreciationGlAccountId: "exp-1",
      accumulatedDepreciationGlAccountId: "accum-1",
      disposalGainGlAccountId: "gain-1",
      disposalLossGlAccountId: "loss-1",
    };
    expect(pickCategoryAccount(full, "assetCost")).toBe("cost-1");
    expect(pickCategoryAccount(full, "depreciationExpense")).toBe("exp-1");
    expect(pickCategoryAccount(full, "accumulatedDepreciation")).toBe(
      "accum-1",
    );
    expect(pickCategoryAccount(full, "disposalGain")).toBe("gain-1");
    expect(pickCategoryAccount(full, "disposalLoss")).toBe("loss-1");
  });

  it("never confuses the depreciation expense with its contra", () => {
    // The single pre-existing `depreciationGlAccountId` column is the EXPENSE.
    // Reading it as the accumulated-depreciation contra would post both legs of
    // the entry to the same account — balanced, and completely wrong.
    const expenseOnly = { ...BARE, depreciationGlAccountId: "exp-1" };
    expect(pickCategoryAccount(expenseOnly, "depreciationExpense")).toBe(
      "exp-1",
    );
    expect(
      pickCategoryAccount(expenseOnly, "accumulatedDepreciation"),
    ).toBeNull();
  });
});

describe("fixed asset accounts — resolution", () => {
  it("prefers the category override over the entity mapping", async () => {
    const tx = txWithMappings({ fa_depreciation_expense: "entity-exp" });
    const category = { ...BARE, depreciationGlAccountId: "category-exp" };
    await expect(
      resolveFixedAssetAccount(tx, "e1", category, "depreciationExpense"),
    ).resolves.toBe("category-exp");
  });

  it("falls back to the entity mapping when the category has no override", async () => {
    const tx = txWithMappings({ fa_depreciation_expense: "entity-exp" });
    await expect(
      resolveFixedAssetAccount(tx, "e1", BARE, "depreciationExpense"),
    ).resolves.toBe("entity-exp");
  });

  it("throws naming BOTH the category and the role when nothing is mapped", async () => {
    const tx = txWithMappings({});
    // "No GL account mapped for fa_disposal_loss" alone does not tell an
    // accountant which of twelve categories to go and fix.
    await expect(
      resolveFixedAssetAccount(tx, "e1", BARE, "disposalLoss"),
    ).rejects.toThrow(/Loss on disposal.*"IT".*fa_disposal_loss/s);
  });
});

describe("fixed asset accounts — run preflight (fail-closed, fail-whole)", () => {
  const IT = { ...BARE, code: "IT" };
  const FF = { ...BARE, code: "FF" };

  it("resolves every category/role pair when fully mapped", async () => {
    const tx = txWithMappings({
      fa_depreciation_expense: "exp",
      fa_accumulated_depreciation: "accum",
    });
    const resolved = await assertFixedAssetAccountsConfigured(
      tx,
      "e1",
      [IT, FF],
      DEPRECIATION_ROLES,
    );
    expect(resolved.get("IT")).toEqual({
      depreciationExpense: "exp",
      accumulatedDepreciation: "accum",
    });
    expect(resolved.get("FF")?.accumulatedDepreciation).toBe("accum");
  });

  it("refuses the WHOLE run rather than silently skipping an unmapped category", async () => {
    // FF overrides its expense account; IT relies on the entity mapping, which
    // is absent. Skipping IT would understate depreciation behind a green
    // "posted" badge — so the run must refuse entirely.
    const tx = txWithMappings({ fa_accumulated_depreciation: "accum" });
    const mappedFF = { ...FF, depreciationGlAccountId: "ff-exp" };
    await expect(
      assertFixedAssetAccountsConfigured(
        tx,
        "e1",
        [IT, mappedFF],
        DEPRECIATION_ROLES,
      ),
    ).rejects.toThrow(/Cannot post/);
  });

  it("reports every unmapped account at once, not just the first", async () => {
    const tx = txWithMappings({});
    let message = "";
    try {
      await assertFixedAssetAccountsConfigured(
        tx,
        "e1",
        [IT, FF],
        DEPRECIATION_ROLES,
      );
    } catch (e) {
      message = (e as Error).message;
    }
    // 2 categories x 2 roles — fixing them one re-run at a time is the failure
    // mode this message exists to prevent.
    expect(message).toMatch(/4 unmapped/);
    expect(message).toContain("IT");
    expect(message).toContain("FF");
  });

  it("a disposal requires the loss account even when this disposal makes a gain", async () => {
    // Which of gain/loss an entry uses depends on the proceeds, so resolving
    // lazily would fail mid-approval on the first loss-making disposal.
    const tx = txWithMappings({
      fa_asset_cost: "cost",
      fa_accumulated_depreciation: "accum",
      fa_disposal_gain: "gain",
    });
    expect(DISPOSAL_ROLES).toContain("disposalLoss");
    await expect(
      assertFixedAssetAccountsConfigured(tx, "e1", [IT], DISPOSAL_ROLES),
    ).rejects.toThrow(/Loss on disposal/);
  });
});
