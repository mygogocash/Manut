import type { Prisma } from "@manut/database";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateVoucherEntryInput,
  ImportVoucherEntriesInput,
  ReorderVoucherEntriesInput,
  UpdateVoucherEntryInput,
  VoucherQuery,
} from "@/modules/voucher-crm/voucher-crm.validation";

const creatorSelect = {
  creator: { select: { id: true, name: true, email: true } },
} satisfies Prisma.VoucherEntryInclude;

export class VoucherCrmService {
  async list(query: VoucherQuery) {
    const { page, limit, search, country } = query;
    const where: Prisma.VoucherEntryWhereInput = {};
    if (search?.trim()) {
      where.OR = [
        { partner: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }
    if (country?.trim()) where.country = country;

    const [data, total, totals] = await Promise.all([
      prisma.voucherEntry.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: creatorSelect,
      }),
      prisma.voucherEntry.count({ where }),
      // Grand totals across EVERY matching row (not just this page),
      // so the UI's summary row mirrors the imported values.
      prisma.voucherEntry.aggregate({
        where,
        _sum: { redeemed: true, issued: true, refund: true },
      }),
    ]);

    return {
      data,
      totals: {
        redeemed: totals._sum.redeemed ?? 0,
        issued: totals._sum.issued ?? 0,
        refund: totals._sum.refund ?? 0,
      },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const row = await prisma.voucherEntry.findUnique({
      where: { id },
      include: creatorSelect,
    });
    if (!row) throw new NotFoundException("Voucher entry not found");
    return row;
  }

  async create(input: CreateVoucherEntryInput, actorId: string) {
    // New rows land at the bottom of the list.
    const last = await prisma.voucherEntry.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return prisma.voucherEntry.create({
      data: {
        partner: input.partner.trim(),
        country: input.country?.trim() || null,
        redeemed: input.redeemed ?? 0,
        issued: input.issued ?? 0,
        refund: input.refund ?? 0,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        addedBy: actorId,
      },
      include: creatorSelect,
    });
  }

  async update(id: string, input: UpdateVoucherEntryInput) {
    await this.getById(id);
    return prisma.voucherEntry.update({
      where: { id },
      data: {
        ...(input.partner !== undefined && { partner: input.partner.trim() }),
        ...(input.country !== undefined && {
          country: input.country?.trim() || null,
        }),
        ...(input.redeemed !== undefined && { redeemed: input.redeemed }),
        ...(input.issued !== undefined && { issued: input.issued }),
        ...(input.refund !== undefined && { refund: input.refund }),
      },
      include: creatorSelect,
    });
  }

  async delete(id: string) {
    await this.getById(id);
    await prisma.voucherEntry.delete({ where: { id } });
    return { success: true as const };
  }

  async importRows(input: ImportVoucherEntriesInput, actorId: string) {
    // Create-new-only bulk import. Append after the current max
    // sortOrder so imported rows land at the bottom in file order.
    const last = await prisma.voucherEntry.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const base = (last?.sortOrder ?? 0) + 1;
    const result = await prisma.voucherEntry.createMany({
      data: input.rows.map((r, idx) => ({
        partner: r.partner.trim(),
        country: r.country?.trim() || null,
        redeemed: r.redeemed ?? 0,
        issued: r.issued ?? 0,
        refund: r.refund ?? 0,
        sortOrder: base + idx,
        addedBy: actorId,
      })),
    });
    return { created: result.count };
  }

  async reorder(input: ReorderVoucherEntriesInput) {
    await prisma.$transaction(
      input.orderedIds.map((id, idx) =>
        prisma.voucherEntry.update({
          where: { id },
          data: { sortOrder: idx },
        }),
      ),
    );
    return { success: true as const };
  }
}

export const voucherCrmService = new VoucherCrmService();
