import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateInvestorTagInput,
  ListInvestorTagsQuery,
  ReorderInvestorTagsInput,
  UpdateInvestorTagInput,
} from "@/modules/investor-tags/investor-tags.validation";

export class InvestorTagService {
  async list(query: ListInvestorTagsQuery) {
    const where = query.includeInactive ? {} : { isActive: true };
    return prisma.investorTag.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  async create(input: CreateInvestorTagInput) {
    const dup = await prisma.investorTag.findUnique({
      where: { code: input.code },
    });
    if (dup) {
      throw new ConflictException(
        `A tag with code "${input.code}" already exists.`,
      );
    }

    // Append to the end unless the admin pinned a position.
    const last = await prisma.investorTag.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (last ? last.sortOrder + 10 : 10);

    return prisma.investorTag.create({
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

  async update(id: string, input: UpdateInvestorTagInput) {
    const existing = await prisma.investorTag.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tag not found");
    }
    // Matches BusinessUnitService: a system row can be recoloured, re-sorted
    // and deactivated, but not relabeled out from under existing records.
    if (existing.isSystem && input.label !== undefined) {
      throw new ForbiddenException(
        "System tags cannot be relabeled. Deactivate and create a custom replacement.",
      );
    }
    return prisma.investorTag.update({
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
   * Write the manual list order. `orderedIds` is the list top to bottom; each
   * row's sortOrder becomes its index. There is no unique constraint on
   * sort_order, so a single-phase transaction is safe — no negative-park
   * dance needed (unlike the cash-advance approval steps, whose `order` is
   * `@unique`).
   */
  async reorder(input: ReorderInvestorTagsInput) {
    const rows = await prisma.investorTag.findMany({
      where: { id: { in: input.orderedIds } },
      select: { id: true },
    });
    if (rows.length !== input.orderedIds.length) {
      throw new NotFoundException("One or more tags were not found");
    }

    await prisma.$transaction(
      input.orderedIds.map((id, idx) =>
        prisma.investorTag.update({
          where: { id },
          data: { sortOrder: idx },
        }),
      ),
    );
    return { success: true, reordered: input.orderedIds.length };
  }

  /**
   * How many investors currently carry this tag. Surfaced by the Manage
   * dialog so the confirm step can say what deleting will actually touch,
   * rather than asking for a blind confirmation.
   */
  async usageCount(code: string) {
    return prisma.investor.count({ where: { tags: { has: code } } });
  }

  /**
   * Hard-delete a tag AND strip its code from every investor still carrying
   * it, in one transaction.
   *
   * There is no FK to lean on (investors hold the code as an open string), so
   * deleting has to choose:
   *   (a) strip the code from investors — tidy catalog, loses the historical
   *       fact that the row came from that batch. This is what we do, and it
   *       matches BusinessUnitService.delete.
   *   (b) leave the codes orphaned — history kept, but chips render the raw
   *       code forever (the LostReason behaviour).
   * Offer `isActive: false` as the keep-the-history alternative; the Manage
   * dialog says so in the confirm copy.
   *
   * `array_remove` is a no-op on rows that do not hold the code, so a retried
   * delete is harmless. The table name is a literal — never caller input —
   * and the code itself stays a bound parameter.
   */
  async delete(id: string) {
    const existing = await prisma.investorTag.findUnique({
      where: { id },
      select: { id: true, code: true, isSystem: true },
    });
    if (!existing) {
      throw new NotFoundException("Tag not found");
    }
    if (existing.isSystem) {
      throw new ForbiddenException(
        "System tags cannot be deleted. Use the deactivate toggle instead.",
      );
    }

    const stripped = await prisma.$transaction(async (tx) => {
      const affected = await tx.$executeRawUnsafe(
        `UPDATE "investors" SET "tags" = array_remove("tags", $1) WHERE $1 = ANY("tags")`,
        existing.code,
      );
      await tx.investorTag.delete({ where: { id } });
      return affected;
    });

    return { success: true, investorsUntagged: stripped };
  }
}

export const investorTagService = new InvestorTagService();
