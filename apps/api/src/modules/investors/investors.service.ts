import type { InputJsonValue, Prisma } from "@manut/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import {
  buildInvestorWhere,
  investorsRepository,
} from "@/modules/investors/investors.repository";
import type {
  BulkDeleteInvestorsInput,
  BulkUpdateInvestorsInput,
  CreateInvestorInput,
  ImportInvestorsInput,
  ReorderInvestorsInput,
  UpdateInvestorInput,
} from "@/modules/investors/investors.validation";

function canReadAll(permissions: string[]): boolean {
  return permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
}

// Resolve a bulk selection to a Prisma where. Either an explicit id list
// or "all matching the filter". `ownerScope` (set for non read-all
// callers) is ANDed in both modes so a caller can never touch rows they
// don't own — even by passing foreign ids.
function bulkSelectionWhere(
  input: {
    ids?: string[];
    allMatching?: boolean;
    filter?: { search?: string; type?: string; status?: string };
  },
  ownerScope: string | undefined,
): Prisma.InvestorWhereInput {
  if (input.allMatching) {
    return buildInvestorWhere({ ...(input.filter ?? {}), addedBy: ownerScope });
  }
  return {
    id: { in: input.ids ?? [] },
    ...(ownerScope ? { addedBy: ownerScope } : {}),
  };
}

export const investorsService = {
  async list(
    actorId: string,
    actorPermissions: string[],
    page: number,
    limit: number,
    search?: string,
    type?: string,
    status?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
  ) {
    // Without `investors:read-all`, callers only see investors they
    // added themselves. CEO/Admin keeps full visibility.
    const addedBy = canReadAll(actorPermissions) ? undefined : actorId;
    const { data, total } = await investorsRepository.findAll(
      page,
      limit,
      search,
      type,
      status,
      addedBy,
      sortBy,
      sortOrder,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // Per-stage est/act roll-up for the pipeline columns. Mirrors `list`
  // scoping so the totals match what the caller can actually see.
  async pipelineTotals(actorId: string, actorPermissions: string[]) {
    const addedBy = canReadAll(actorPermissions) ? undefined : actorId;
    return investorsRepository.pipelineTotals(addedBy);
  },

  // Apply status / type / owner to many investors at once (the selection
  // bar). Non read-all callers are scoped to investors they added.
  async bulkUpdate(
    actorId: string,
    actorPermissions: string[],
    input: BulkUpdateInvestorsInput,
  ) {
    // Reassigning the owner is an admin-style action.
    if (input.set.addedBy && !canReadAll(actorPermissions)) {
      throw new ForbiddenException(
        "Reassigning owner requires investors:read-all access.",
      );
    }
    const ownerScope = canReadAll(actorPermissions) ? undefined : actorId;
    const where = bulkSelectionWhere(input, ownerScope);
    const data: Prisma.InvestorUncheckedUpdateManyInput = {
      ...(input.set.status !== undefined && { status: input.set.status }),
      ...(input.set.type !== undefined && { type: input.set.type }),
      ...(input.set.addedBy !== undefined && { addedBy: input.set.addedBy }),
    };
    const result = await investorsRepository.bulkUpdate(where, data);
    return { updated: result.count };
  },

  async bulkDelete(
    actorId: string,
    actorPermissions: string[],
    input: BulkDeleteInvestorsInput,
  ) {
    const ownerScope = canReadAll(actorPermissions) ? undefined : actorId;
    const where = bulkSelectionWhere(input, ownerScope);
    const result = await investorsRepository.bulkDelete(where);
    return { deleted: result.count };
  },

  async getById(id: string, actorId: string, actorPermissions: string[]) {
    const investor = await investorsRepository.findById(id);
    if (!investor) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && investor.addedBy !== actorId) {
      throw new ForbiddenException("You can only view investors you added");
    }
    return investor;
  },

  async create(addedBy: string, input: CreateInvestorInput) {
    return investorsRepository.create({
      name: input.name,
      type: input.type,
      status: input.status,
      visibility: input.visibility,
      contactName: input.contactName || undefined,
      contactEmail: input.contactEmail || undefined,
      contactPhone: input.contactPhone || undefined,
      website: input.website || undefined,
      location: input.location || undefined,
      notes: input.notes as InputJsonValue,
      // Pipeline import columns. Empty strings convert
      // to null so a cleared field on edit lands as null, not an
      // empty string that would fail downstream URL / date pickers.
      title: input.title || null,
      linkedinUrl: input.linkedinUrl || null,
      revenueStream: input.revenueStream || null,
      lastContactDate: input.lastContactDate
        ? new Date(input.lastContactDate)
        : null,
      nextAction: input.nextAction || null,
      actInvestment: input.actInvestment || null,
      estInvestment: input.estInvestment || null,
      crossSell: input.crossSell || null,
      region: input.region || null,
      notesText: input.notesText || null,
      addedBy,
    });
  },

  async update(
    id: string,
    input: UpdateInvestorInput,
    actorId: string,
    actorPermissions: string[],
  ) {
    const existing = await investorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && existing.addedBy !== actorId) {
      throw new ForbiddenException("You can only edit investors you added");
    }
    const { lastContactDate, ...rest } = input;
    return investorsRepository.update(id, {
      ...rest,
      notes: input.notes as InputJsonValue,
      // String fields go through unchanged — Prisma maps "" → empty
      // string; the repo treats undefined as "do not touch". Date
      // gets the same `""` → `null` treatment as create.
      ...(lastContactDate !== undefined && {
        lastContactDate: lastContactDate ? new Date(lastContactDate) : null,
      }),
    });
  },

  async delete(id: string, actorId: string, actorPermissions: string[]) {
    const existing = await investorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Investor not found");
    if (!canReadAll(actorPermissions) && existing.addedBy !== actorId) {
      throw new ForbiddenException("You can only delete investors you added");
    }
    return investorsRepository.delete(id);
  },

  // Bulk import from the xlsx / csv import dialog. Each row goes
  // through the same `create()` path the form uses so unique
  // constraints + JSON `notes` coercion stay consistent. Rows that
  // raise are counted under `skipped` rather than failing the whole
  // batch — the team can re-import the deltas once they fix the bad
  // rows. The actor's id is stamped on every created row so the
  // `addedBy` ownership scoping still applies.
  async bulkCreate(addedBy: string, input: ImportInvestorsInput) {
    let created = 0;
    let skipped = 0;
    for (const row of input.rows) {
      try {
        await this.create(addedBy, row);
        created++;
      } catch {
        skipped++;
      }
    }
    return { created, skipped };
  },

  async dashboard() {
    return investorsRepository.dashboardKpis();
  },

  // Persist the BD team's manual ordering. Reps without
  // `investors:read-all` may only reorder rows they added; if any
  // submitted id falls outside that scope, reject the batch so a
  // partial write can't leave the grid half-arranged. Mirrors the
  // sales-crm reorder guard.
  async reorder(
    actorId: string,
    permissions: string[],
    input: ReorderInvestorsInput,
  ) {
    const canReorderAll = canReadAll(permissions);
    if (!canReorderAll) {
      const owned = await investorsRepository.findIdsOwnedBy(
        input.orderedIds,
        actorId,
      );
      if (owned.length !== input.orderedIds.length) {
        throw new BadRequestException(
          "Reorder includes investors you didn't add. Drop the unowned rows or ask for investors:read-all access.",
        );
      }
    }
    await investorsRepository.reorder(input.orderedIds);
    return { success: true };
  },
};
