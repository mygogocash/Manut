import type {
  BulkDeleteInvestorsInput,
  BulkTagsInvestorsInput,
  BulkUpdateInvestorsInput,
  CreateInvestorInput,
  ImportInvestorsInput,
  ReorderInvestorsInput,
  UpdateInvestorInput,
} from "@nexora/contracts/modules/investors/investors.validation";
import type { Db } from "@nexora/db";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import { resolveFundraisingEntityKey } from "../fundraising-entities/fundraising-entities.service";
import {
  canReadAllInvestors,
  investorAddedByScope,
  investorOwnerScope,
} from "./investor-rbac";
import type { InvestorFilters } from "./investors.repository";
import * as repo from "./investors.repository";

export interface ListInvestorsQuery {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  archived?: boolean;
  fundraisingEntity?: string;
  tag?: string;
}

function bulkWhere(
  input: {
    ids?: string[];
    allMatching?: boolean;
    filter?: Omit<InvestorFilters, "addedBy" | "ownerScope" | "ids">;
  },
  ownerScope: string | undefined,
): InvestorFilters {
  if (input.allMatching) {
    return { ...(input.filter ?? {}), addedBy: ownerScope };
  }
  return { ids: input.ids ?? [], ...(ownerScope ? { ownerScope: [ownerScope] } : {}) };
}

export async function list(
  db: Db,
  userId: string,
  permissions: string[],
  query: ListInvestorsQuery,
) {
  const { page, limit, sortBy, sortOrder, archived, ...filters } = query;
  const addedBy = investorAddedByScope(userId, permissions);
  const { data, total } = await repo.findMany(
    db,
    { ...filters, addedBy, archived: archived ?? false },
    page,
    limit,
    sortBy,
    sortOrder,
  );
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function pipelineTotals(
  db: Db,
  userId: string,
  permissions: string[],
  filters: Omit<InvestorFilters, "addedBy"> = {},
) {
  const addedBy = investorAddedByScope(userId, permissions);
  return repo.pipelineTotals(db, { ...filters, addedBy });
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const investor = await repo.findById(db, id);
  if (!investor) throw new NotFoundException("Investor not found");
  if (!canReadAllInvestors(permissions) && investor.addedBy !== userId) {
    throw new ForbiddenException("You can only view investors you added");
  }
  return investor;
}

export async function create(db: Db, addedBy: string, input: CreateInvestorInput) {
  const fundraisingEntity = await resolveFundraisingEntityKey(db, input.fundraisingEntity);
  return repo.create(db, {
    name: input.name,
    type: input.type,
    status: input.status,
    visibility: input.visibility,
    contactName: input.contactName || null,
    contactEmail: input.contactEmail || null,
    contactPhone: input.contactPhone || null,
    website: input.website || null,
    location: input.location || null,
    notes: input.notes ?? null,
    title: input.title || null,
    linkedinUrl: input.linkedinUrl || null,
    revenueStream: input.revenueStream || null,
    lastContactDate: input.lastContactDate || null,
    nextAction: input.nextAction || null,
    actInvestment: input.actInvestment || null,
    estInvestment: input.estInvestment || null,
    crossSell: input.crossSell || null,
    region: input.region || null,
    notesText: input.notesText || null,
    tags: input.tags ?? [],
    fundraisingEntity,
    addedBy,
    sortOrder: 0,
  });
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateInvestorInput,
) {
  await getById(db, id, userId, permissions);
  const { lastContactDate, fundraisingEntity, ...rest } = input;
  return repo.update(db, id, {
    ...rest,
    ...(lastContactDate !== undefined && {
      lastContactDate: lastContactDate || null,
    }),
    ...(fundraisingEntity !== undefined && {
      fundraisingEntity: await resolveFundraisingEntityKey(db, fundraisingEntity),
    }),
  });
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  await repo.remove(db, id);
}

export async function archive(db: Db, id: string, userId: string, permissions: string[]) {
  const existing = await getById(db, id, userId, permissions);
  return repo.update(db, id, {
    archivedAt: existing.archivedAt ?? new Date().toISOString(),
  });
}

export async function unarchive(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  return repo.update(db, id, { archivedAt: null });
}

export async function reorder(
  db: Db,
  userId: string,
  permissions: string[],
  input: ReorderInvestorsInput,
) {
  if (!canReadAllInvestors(permissions)) {
    const owned = await repo.countMatching(db, {
      ids: input.orderedIds,
      addedBy: userId,
    });
    if (owned !== input.orderedIds.length) {
      throw new BadRequestException(
        "Reorder includes investors you don't own. Drop the unowned rows or ask for read-all access.",
      );
    }
  }
  await repo.reorder(db, input.orderedIds);
  return { success: true };
}

export async function bulkUpdate(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkUpdateInvestorsInput,
) {
  if (input.set.addedBy && !canReadAllInvestors(permissions)) {
    throw new ForbiddenException("Reassigning owner requires investors:read-all access.");
  }
  const fundraisingEntity =
    input.set.fundraisingEntity !== undefined
      ? await resolveFundraisingEntityKey(db, input.set.fundraisingEntity)
      : undefined;
  const ownerScope = investorAddedByScope(userId, permissions);
  const where = bulkWhere(input, ownerScope);
  const selected =
    input.set.archived !== undefined ? await repo.countMatching(db, where) : undefined;

  const patch: Parameters<typeof repo.updateMany>[2] = {
    ...(input.set.status !== undefined && { status: input.set.status }),
    ...(input.set.type !== undefined && { type: input.set.type }),
    ...(fundraisingEntity !== undefined && { fundraisingEntity }),
    ...(input.set.addedBy !== undefined && { addedBy: input.set.addedBy }),
    ...(input.set.archived !== undefined && {
      archivedAt: input.set.archived ? new Date().toISOString() : null,
    }),
  };

  let effectiveWhere = where;
  if (input.set.archived !== undefined) {
    effectiveWhere = {
      ...where,
      archived: !input.set.archived,
    };
  }

  const result = await repo.updateMany(db, effectiveWhere, patch);
  return {
    updated: result.count,
    selected: selected ?? result.count,
    skipped: selected === undefined ? 0 : selected - result.count,
    failed: [] as string[],
  };
}

export async function bulkSetTags(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkTagsInvestorsInput,
) {
  const ownerScope = investorAddedByScope(userId, permissions);
  const where = bulkWhere(input, ownerScope);
  const selected = await repo.countMatching(db, where);

  if (input.mode === "replace") {
    await repo.updateMany(db, where, { tags: input.codes });
    return { selected, updated: selected, skipped: 0, failed: [] as string[] };
  }

  const codes = [...new Set(input.codes)];
  if (codes.length === 0) {
    return { selected, updated: 0, skipped: selected, failed: [] as string[] };
  }

  await repo.addTagCodes(db, where, codes);
  return { selected, updated: selected, skipped: 0, failed: [] as string[] };
}

export async function bulkDelete(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkDeleteInvestorsInput,
) {
  const ownerScope = investorAddedByScope(userId, permissions);
  const where = bulkWhere(input, ownerScope);
  const result = await repo.deleteMany(db, where);
  return { deleted: result.count };
}

/** Stub — full KPI roll-up lands in a follow-up PR. */
export async function dashboard(_db: Db, _fundraisingEntity?: string) {
  return {
    totalInvestors: 0,
    totalInvestments: 0,
    totalCommitted: 0,
    totalReceived: 0,
    totalEstInvestment: 0,
    totalActInvestment: 0,
    statusBreakdown: {} as Record<string, number>,
    byCurrency: {} as Record<string, { committed: number; received: number }>,
  };
}

/** Stub — import preview/commit wiring follows in a follow-up PR. */
export async function previewImport(_db: Db, input: ImportInvestorsInput) {
  return {
    rows: input.rows.map((row, index) => ({
      index,
      action: "insert" as const,
      name: row.name,
      errors: [] as string[],
    })),
    missingTags: [] as string[],
    summary: {
      total: input.rows.length,
      inserts: input.rows.length,
      updates: 0,
      invalid: 0,
      tagsToCreate: 0,
    },
  };
}

export async function bulkCreate(db: Db, addedBy: string, input: ImportInvestorsInput) {
  let created = 0;
  let skipped = 0;
  for (const row of input.rows) {
    try {
      await create(db, addedBy, row);
      created++;
    } catch {
      skipped++;
    }
  }
  return { created, skipped };
}
