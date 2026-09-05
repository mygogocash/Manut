import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  type BusinessUnitProgress,
  computeOpportunityRollup,
} from "@/modules/crm-shared/opportunity-rollup";

/**
 * Roll-up recompute for the PARKED `revenue_opportunities` table.
 *
 * The ARIA Revenue module was retired 2026-08-26 — its deals migrated onto
 * the Sales CRM board tagged `aria`, its API modules were deleted, and its
 * `revenue_*` tables were kept untouched as the rollback safety net. This
 * file exists because ONE live code path still writes those tables:
 * `businessUnitService.delete` strips a deleted unit's code from every
 * `business_units` column, revenue tables included, and each stripped deal's
 * derived fields must then be re-derived or the parked data would be left
 * internally inconsistent — worthless as a rollback target.
 *
 * It is a straight extraction of `recomputeOpportunityRollup` (and the slice
 * of the stage catalog it needs) from the deleted
 * `revenue-opportunities/opportunity-business-units.repository.ts`. Do not
 * grow it: any new revenue-table write path belongs in a revived module, not
 * here. Dies with the tables in the cleanup PR that drops them.
 */

type Db = Prisma.TransactionClient | typeof prisma;
const client = (tx?: Prisma.TransactionClient): Db => tx ?? prisma;

/**
 * Mirrors the `sort_order` values `20261101000000_sales_revenue_crm_init`
 * seeded into `revenue_stage_config` (which deliberately diverges from the
 * Sales CRM's scale — live 50 / closed_lost 60 vs 45 / 50).
 */
const CODE_STAGE_SORT_ORDER: Record<string, number> = {
  qualified: 10,
  proposal: 20,
  negotiation: 30,
  closed_won: 40,
  live: 50,
  closed_lost: 60,
};

/**
 * Code constants overlaid per key by the (frozen) `revenue_stage_config`
 * catalog — same precedence the retired module used, kept so the roll-up
 * ranks stages exactly as it always did on this table.
 */
async function stageSortOrder(
  tx?: Prisma.TransactionClient,
): Promise<Map<string, number>> {
  const rows = await client(tx).revenueStageConfig.findMany({
    select: { key: true, sortOrder: true },
  });
  const order = new Map<string, number>(Object.entries(CODE_STAGE_SORT_ORDER));
  for (const row of rows) order.set(row.key, row.sortOrder);
  return order;
}

/**
 * Re-derive one parked revenue deal's fields from its child rows.
 *
 * Same null contract as the live Sales CRM recompute: a deal with no child
 * rows keeps its stored values — resetting would wipe every untagged deal
 * back to qualified / 0.
 */
export async function recomputeRevenueOpportunityRollup(
  opportunityId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = client(tx);
  const deal = await db.revenueOpportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, businessUnits: true },
  });
  if (!deal) return;

  const children: BusinessUnitProgress[] =
    await db.revenueOpportunityBusinessUnit.findMany({
      where: { opportunityId },
      // Stable input: computeOpportunityRollup tie-breaks on the unit code,
      // but an unordered read would still vary the Decimal sum's operand
      // order between runs.
      orderBy: { businessUnit: "asc" },
      select: {
        businessUnit: true,
        stage: true,
        probability: true,
        probabilityCustom: true,
        value: true,
        closeDate: true,
        launchDate: true,
        revenueLaunchDate: true,
        lostReason: true,
        sortOrderWithinStage: true,
      },
    });

  const rollup = computeOpportunityRollup(
    children,
    await stageSortOrder(tx),
    deal.businessUnits,
  );
  if (rollup === null) return;

  await db.revenueOpportunity.update({
    where: { id: opportunityId },
    data: rollup,
  });
}
