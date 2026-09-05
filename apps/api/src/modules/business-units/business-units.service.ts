import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateBusinessUnitInput,
  ListBusinessUnitsQuery,
  ReorderBusinessUnitsInput,
  UpdateBusinessUnitInput,
} from "@/modules/business-units/business-units.validation";
import { recomputeRevenueOpportunityRollup as recomputeRevenueRollup } from "@/modules/business-units/revenue-rollup.repository";
import { recomputeOpportunityRollup as recomputeSalesRollup } from "@/modules/opportunities/opportunity-business-units.repository";

/**
 * Every table that carries a `business_units` text[] column. Used only by
 * `delete` to strip a retired code from records that still reference it.
 *
 * A module-level literal — these names are interpolated into SQL, so they
 * must never come from caller input. The code itself stays a bound param.
 */
export const BUSINESS_UNIT_TABLES = [
  "crm_opportunities",
  "crm_leads",
  "crm_accounts",
  "revenue_opportunities",
  "revenue_leads",
  "revenue_accounts",
] as const;

export class BusinessUnitService {
  async list(query: ListBusinessUnitsQuery) {
    const where = query.includeInactive ? {} : { isActive: true };
    return prisma.crmBusinessUnit.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  async create(input: CreateBusinessUnitInput) {
    const dup = await prisma.crmBusinessUnit.findUnique({
      where: { code: input.code },
    });
    if (dup) {
      throw new ConflictException(
        `A business unit with code "${input.code}" already exists.`,
      );
    }

    // Append to the end of the list unless the admin pinned a position.
    const last = await prisma.crmBusinessUnit.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (last ? last.sortOrder + 10 : 10);

    return prisma.crmBusinessUnit.create({
      data: {
        code: input.code,
        label: input.label,
        color: input.color ?? "grey",
        sortOrder,
        isSystem: false,
        isActive: true,
      },
    });
  }

  async update(id: string, input: UpdateBusinessUnitInput) {
    const existing = await prisma.crmBusinessUnit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Business unit not found");
    }
    // Matches LostReasonService: a system row can be recoloured, re-sorted
    // and deactivated, but not relabeled out from under existing records.
    if (existing.isSystem && input.label !== undefined) {
      throw new ForbiddenException(
        "System business units cannot be relabeled. Deactivate and create a custom replacement.",
      );
    }
    return prisma.crmBusinessUnit.update({
      where: { id },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /**
   * Write the manual list order. `orderedIds` is the list top to bottom;
   * each row's sortOrder becomes its index. There is no unique constraint on
   * sort_order, so a single-phase transaction is safe — no negative-park
   * dance needed.
   */
  async reorder(input: ReorderBusinessUnitsInput) {
    const rows = await prisma.crmBusinessUnit.findMany({
      where: { id: { in: input.orderedIds } },
      select: { id: true },
    });
    if (rows.length !== input.orderedIds.length) {
      throw new NotFoundException("One or more business units were not found");
    }

    await prisma.$transaction(
      input.orderedIds.map((id, idx) =>
        prisma.crmBusinessUnit.update({
          where: { id },
          data: { sortOrder: idx },
        }),
      ),
    );
    return { success: true, reordered: input.orderedIds.length };
  }

  /**
   * Hard-delete a unit AND strip its code from every record still tagged
   * with it, in one transaction.
   *
   * Policy note — there is no FK to lean on (records store the code as an
   * open string, like Opportunity.lostReason), so deleting has to choose:
   *   (a) strip the code from records — tidy list, loses the historical fact
   *       that the deal belonged to that unit. This is what we do.
   *   (b) leave the codes orphaned — history preserved, but chips render the
   *       raw code forever (the LostReason behaviour).
   *   (c) require a reassign target, like
   *       InvestorPipelineStageRepository.deleteAndReassign.
   * Switching to (b) means dropping the loop; (c) means taking a
   * `reassignTo` code and using array_replace instead of array_remove.
   *
   * `array_remove` is a no-op on rows that don't hold the code, so a retried
   * delete is harmless.
   */
  async delete(id: string) {
    const existing = await prisma.crmBusinessUnit.findUnique({
      where: { id },
      select: { id: true, code: true, isSystem: true },
    });
    if (!existing) {
      throw new NotFoundException("Business unit not found");
    }
    if (existing.isSystem) {
      throw new ForbiddenException(
        "System business units cannot be deleted. Use the deactivate toggle instead.",
      );
    }

    await prisma.$transaction(async (tx) => {
      // Collected BEFORE the strip: afterwards `businessUnits has code`
      // matches nothing, so a query issued later would find no deals and
      // every one of them would keep a stale roll-up.
      const [salesDeals, revenueDeals] = await Promise.all([
        tx.opportunity.findMany({
          where: { businessUnits: { has: existing.code } },
          select: { id: true },
        }),
        tx.revenueOpportunity.findMany({
          where: { businessUnits: { has: existing.code } },
          select: { id: true },
        }),
      ]);

      for (const table of BUSINESS_UNIT_TABLES) {
        await tx.$executeRawUnsafe(
          `UPDATE "${table}" SET "business_units" = array_remove("business_units", $1)`,
          existing.code,
        );
      }

      // Policy (a) above strips the tag, so the per-unit progress rows go
      // with it. There is deliberately no FK to cascade for us, so an
      // orphan would survive — and `computeOpportunityRollup` still counts
      // a row missing from the tag array toward the deal's value and can
      // still pick it as least-advanced, pinning the deal's stage to a
      // unit nobody can see any more.
      await Promise.all([
        tx.opportunityBusinessUnit.deleteMany({
          where: { businessUnit: existing.code },
        }),
        tx.revenueOpportunityBusinessUnit.deleteMany({
          where: { businessUnit: existing.code },
        }),
      ]);

      // After the rows are gone, so the recompute cannot read the doomed
      // one. A deal left with no units keeps its stored values — the
      // documented null contract on the roll-up.
      for (const deal of salesDeals) {
        await recomputeSalesRollup(deal.id, tx);
      }
      for (const deal of revenueDeals) {
        await recomputeRevenueRollup(deal.id, tx);
      }

      await tx.crmBusinessUnit.delete({ where: { id } });
    });
  }
}

export const businessUnitService = new BusinessUnitService();
