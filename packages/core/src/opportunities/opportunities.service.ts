import { PERMISSIONS } from "@nexora/contracts";
import { BUSINESS_UNIT_UNASSIGNED } from "@nexora/contracts/modules/business-units/business-units.validation";
import {
  type OpportunityStage,
  STAGE_PROBABILITY_DEFAULTS,
} from "@nexora/contracts/modules/opportunities/opportunities.constants";
import type {
  BulkFieldUpdateOpportunitiesInput,
  BulkUpdateOpportunitiesInput,
  BulkUpdateStageConfigsInput,
  CloseLostInput,
  CreateOpportunityInput,
  ListOpportunitiesQuery,
  MoveBusinessUnitInput,
  PipelineQuery,
  ReopenOpportunityInput,
  ReorderOpportunityCardsInput,
  UpdateOpportunityInput,
} from "@nexora/contracts/modules/opportunities/opportunities.validation";
import type { Db } from "@nexora/db";
import * as accountsRepository from "../accounts/accounts.repository";
import * as contactsRepository from "../contacts/contacts.repository";
import { applyBulkBusinessUnits, type BulkApplyResult } from "../crm-shared/bulk-apply";
import { applyBulkFieldSet, type BulkFieldResult } from "../crm-shared/bulk-field-set";
import { resolveBulkWhere } from "../crm-shared/bulk-selection";
import type { DealFieldPatch } from "../crm-shared/opportunity-push-down";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import { resolveRate } from "../payroll/payroll.fx";
import * as repo from "./opportunities.repository";
import { moveBusinessUnitRow } from "./opportunity-business-unit-moves";
import {
  ensureBusinessUnitRows,
  listBusinessUnitRows,
  pushDealFieldsToBusinessUnits,
  recomputeOpportunityRollup,
} from "./opportunity-business-units.repository";

function formatValue(n: number): string {
  return n.toFixed(2);
}

export async function list(
  db: Db,
  userId: string,
  permissions: string[],
  query: ListOpportunitiesQuery,
) {
  const { page, limit, ...filters } = query;
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  const { data, total } = await repo.findMany(db, { ...filters, ownerScope }, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function pipeline(
  db: Db,
  userId: string,
  permissions: string[],
  filters: PipelineQuery = {},
) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  return repo.pipelineSummary(db, { ownerScope }, filters);
}

export async function dashboard(db: Db, userId: string, permissions: string[]) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  const rows = await repo.dashboardRows(db, { ownerScope });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stage: r.stage,
    value: Number(r.value),
    currency: r.currency,
    probability: r.probability,
    businessUnits: r.businessUnits,
    launchDate: r.launchDate,
    revenueLaunchDate: r.revenueLaunchDate,
    accountId: r.accountId,
    accountName: r.accountName,
    country: r.country,
    region: r.region,
    industry: r.industry,
    totalUsers: r.totalUsers,
    appUsers: r.appUsers,
    engagementType: r.engagementType,
    ownerName: r.ownerName,
  }));
}

export async function filterOptions(db: Db, userId: string, permissions: string[]) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  return repo.filterOptions(db, { ownerScope });
}

export async function forecast(
  db: Db,
  userId: string,
  permissions: string[],
  reportCurrency: string,
) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  const rows = await repo.forecastRows(db, { ownerScope });
  const target = reportCurrency.toUpperCase();

  let weighted = 0;
  let unweighted = 0;
  let convertedCount = 0;
  const byStage = new Map<
    string,
    { stage: string; count: number; weighted: number; unweighted: number }
  >();
  const missingByCurrency = new Map<string, number>();

  for (const row of rows) {
    const fromCcy = row.currency.toUpperCase();
    const lookup = await resolveRate(db, fromCcy, target);
    const value = Number(row.value);

    if (lookup.source === "missing") {
      missingByCurrency.set(fromCcy, (missingByCurrency.get(fromCcy) ?? 0) + 1);
      continue;
    }

    const inTarget = value * lookup.rate;
    const weightedAmount = inTarget * (row.probability / 100);

    unweighted += inTarget;
    weighted += weightedAmount;
    convertedCount += 1;

    const bucket = byStage.get(row.stage) ?? {
      stage: row.stage,
      count: 0,
      weighted: 0,
      unweighted: 0,
    };
    bucket.count += 1;
    bucket.weighted += weightedAmount;
    bucket.unweighted += inTarget;
    byStage.set(row.stage, bucket);
  }

  return {
    reportCurrency: target,
    totalOpportunities: rows.length,
    convertedCount,
    weighted,
    unweighted,
    byStage: Array.from(byStage.values()).sort((a, b) => a.stage.localeCompare(b.stage)),
    missingRates: Array.from(missingByCurrency.entries())
      .map(([currency, count]) => ({ currency, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const opp = await repo.findById(db, id);
  if (!opp) throw new NotFoundException("Opportunity not found");

  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canSeeAll && opp.ownerId !== userId) {
    throw new NotFoundException("Opportunity not found");
  }

  const ensured = await ensureBusinessUnitRows(db, id, opp.businessUnits ?? []);
  if (ensured.mode === "synced" && (ensured.added.length > 0 || ensured.removed.length > 0)) {
    await recomputeOpportunityRollup(db, id);
    return (await repo.findById(db, id)) ?? opp;
  }

  return opp;
}

async function syncBusinessUnitsAfterWrite(
  db: Db,
  id: string,
  opts: {
    tagOrder?: readonly string[];
    patch?: DealFieldPatch;
    stageAppliesToEveryUnit?: boolean;
  },
) {
  let seeded = false;
  if (opts.tagOrder !== undefined) {
    const ensured = await ensureBusinessUnitRows(db, id, opts.tagOrder);
    seeded = ensured.mode === "seeded";
  }

  const patch = opts.patch;
  const hasPatch = patch !== undefined && Object.keys(patch).length > 0;
  if (hasPatch && !seeded) {
    await pushDealFieldsToBusinessUnits(db, id, patch, {
      stageAppliesToEveryUnit: opts.stageAppliesToEveryUnit ?? false,
    });
  }

  if (opts.tagOrder === undefined && !hasPatch) return null;

  await recomputeOpportunityRollup(db, id);
  return repo.findById(db, id);
}

function dealFieldPatchFromUpdate(
  input: UpdateOpportunityInput,
  derived: { probability?: number; probabilityCustom?: boolean },
): DealFieldPatch {
  return {
    ...(input.stage !== undefined && { stage: input.stage }),
    ...(derived.probability !== undefined && { probability: derived.probability }),
    ...(derived.probabilityCustom !== undefined && {
      probabilityCustom: derived.probabilityCustom,
    }),
    ...(input.value !== undefined && { value: formatValue(input.value) }),
    ...(input.closeDate !== undefined && { closeDate: input.closeDate || null }),
    ...(input.launchDate !== undefined && { launchDate: input.launchDate || null }),
    ...(input.revenueLaunchDate !== undefined && {
      revenueLaunchDate: input.revenueLaunchDate || null,
    }),
  };
}

export async function getStageProbability(db: Db, stage: OpportunityStage): Promise<number> {
  const row = await repo.findStageConfig(db, stage);
  if (row) return row.probability;
  return STAGE_PROBABILITY_DEFAULTS[stage];
}

export async function create(
  db: Db,
  ownerId: string,
  permissions: string[],
  input: CreateOpportunityInput,
) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const effectiveOwnerId = canSeeAll && input.ownerId ? input.ownerId : ownerId;

  const account = await accountsRepository.findById(db, input.accountId);
  if (!account || (!canSeeAll && account.ownerId !== ownerId)) {
    throw new NotFoundException("Account not found");
  }

  if (input.contactId) {
    const contact = await contactsRepository.findById(db, input.contactId);
    if (!contact || contact.accountId !== input.accountId) {
      throw new BadRequestException("Contact does not belong to the supplied account.");
    }
  }

  const stage = input.stage as OpportunityStage;
  const probabilityCustom = input.probability !== undefined;
  const probability = probabilityCustom
    ? input.probability!
    : await getStageProbability(db, stage);

  const created = await repo.create(db, {
    name: input.name,
    accountId: input.accountId,
    contactId: input.contactId ?? null,
    stage,
    value: formatValue(input.value),
    currency: input.currency,
    probability,
    probabilityCustom,
    closeDate: input.closeDate ?? null,
    launchDate: input.launchDate ?? null,
    revenueLaunchDate: input.revenueLaunchDate ?? null,
    type: input.type ?? null,
    notes: input.notes ?? null,
    businessUnits: input.businessUnits ?? [],
    legacyDealId: input.legacyDealId ?? null,
    ownerId: effectiveOwnerId,
  });

  const fresh =
    (await syncBusinessUnitsAfterWrite(db, created!.id, {
      tagOrder: input.businessUnits ?? [],
    })) ?? created;

  return fresh;
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateOpportunityInput,
  options?: { suppressNotifications?: boolean },
) {
  const existing = await getById(db, id, userId, permissions);

  if (input.contactId !== undefined && input.contactId) {
    const contact = await contactsRepository.findById(db, input.contactId);
    if (!contact || contact.accountId !== existing.accountId) {
      throw new BadRequestException("Contact does not belong to this opportunity's account.");
    }
  }

  const stageChanged = input.stage !== undefined && input.stage !== existing.stage;
  const probabilitySupplied = input.probability !== undefined;

  let nextProbability: number | undefined;
  let nextProbabilityCustom: boolean | undefined;

  if (probabilitySupplied) {
    nextProbability = input.probability;
    nextProbabilityCustom = true;
  } else if (stageChanged && !existing.probabilityCustom) {
    nextProbability = await getStageProbability(db, input.stage as OpportunityStage);
  }

  const updated = await repo.update(db, id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.contactId !== undefined && { contactId: input.contactId || null }),
    ...(input.stage !== undefined && { stage: input.stage }),
    ...(stageChanged && { sortOrderWithinStage: 0 }),
    ...(input.value !== undefined && { value: formatValue(input.value) }),
    ...(input.currency !== undefined && { currency: input.currency }),
    ...(nextProbability !== undefined && { probability: nextProbability }),
    ...(nextProbabilityCustom !== undefined && { probabilityCustom: nextProbabilityCustom }),
    ...(input.closeDate !== undefined && {
      closeDate: input.closeDate || null,
      remindersSent: [],
      lastReminderSentAt: null,
    }),
    ...(input.launchDate !== undefined && { launchDate: input.launchDate || null }),
    ...(input.revenueLaunchDate !== undefined && {
      revenueLaunchDate: input.revenueLaunchDate || null,
    }),
    ...(input.type !== undefined && { type: input.type || null }),
    ...(input.notes !== undefined && { notes: input.notes || null }),
    ...(input.ownerId !== undefined &&
      permissions.includes(PERMISSIONS.CRM_TEAM_READ) && { ownerId: input.ownerId }),
    ...(input.legacyDealId !== undefined && { legacyDealId: input.legacyDealId }),
    ...(input.businessUnits !== undefined && { businessUnits: input.businessUnits }),
  });

  const fresh =
    (await syncBusinessUnitsAfterWrite(db, id, {
      ...(input.businessUnits !== undefined && { tagOrder: input.businessUnits }),
      patch: dealFieldPatchFromUpdate(input, {
        probability: nextProbability,
        probabilityCustom: nextProbabilityCustom,
      }),
    })) ?? updated;

  void options;
  return fresh;
}

export async function closeLost(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: CloseLostInput,
) {
  const existing = await getById(db, id, userId, permissions);

  if (existing.stage === "closed_lost") {
    throw new BadRequestException("Opportunity is already closed_lost.");
  }
  if (existing.stage === "closed_won" || existing.stage === "live") {
    throw new BadRequestException(
      `Cannot mark a ${existing.stage} opportunity as lost. Reopen first.`,
    );
  }

  const lostReason = input.lostReason ?? null;
  const probability = await getStageProbability(db, "closed_lost");

  const updated = await repo.update(db, id, {
    stage: "closed_lost",
    lostReason,
    sortOrderWithinStage: 0,
    probability,
  });

  return (
    (await syncBusinessUnitsAfterWrite(db, id, {
      patch: { stage: "closed_lost", probability, lostReason },
      stageAppliesToEveryUnit: true,
    })) ?? updated
  );
}

export async function reopen(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: ReopenOpportunityInput,
) {
  const existing = await getById(db, id, userId, permissions);
  const REOPENABLE = ["closed_won", "closed_lost", "live"];
  if (!REOPENABLE.includes(existing.stage)) {
    throw new BadRequestException(
      "Only closed_won, closed_lost or live opportunities can be reopened.",
    );
  }

  const stage = input.stage as OpportunityStage;
  const nextProbability = existing.probabilityCustom
    ? undefined
    : await getStageProbability(db, stage);

  const updated = await repo.update(db, id, {
    stage,
    lostReason: null,
    sortOrderWithinStage: 0,
    ...(nextProbability !== undefined && { probability: nextProbability }),
  });

  return (
    (await syncBusinessUnitsAfterWrite(db, id, {
      patch: {
        stage,
        lostReason: null,
        ...(nextProbability !== undefined && { probability: nextProbability }),
      },
      stageAppliesToEveryUnit: true,
    })) ?? updated
  );
}

export async function businessUnitsForDeal(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
) {
  await getById(db, id, userId, permissions);
  return listBusinessUnitRows(db, id);
}

export async function moveBusinessUnit(
  db: Db,
  id: string,
  businessUnit: string,
  userId: string,
  permissions: string[],
  input: MoveBusinessUnitInput,
) {
  const deal = await getById(db, id, userId, permissions);

  if (businessUnit === BUSINESS_UNIT_UNASSIGNED) {
    if (input.stage === undefined) return deal;
    return update(db, id, userId, permissions, { stage: input.stage });
  }

  if (!(deal.businessUnits ?? []).includes(businessUnit)) {
    throw new NotFoundException(
      `${businessUnit} is not a business unit on this opportunity`,
    );
  }

  const moved = await moveBusinessUnitRow(db, id, businessUnit, {
    ...(input.stage !== undefined && { stage: input.stage }),
    ...(input.probability !== undefined && { probability: input.probability }),
    ...(input.value !== undefined && { value: formatValue(input.value) }),
    ...(input.closeDate !== undefined && { closeDate: input.closeDate }),
    ...(input.launchDate !== undefined && { launchDate: input.launchDate }),
    ...(input.revenueLaunchDate !== undefined && {
      revenueLaunchDate: input.revenueLaunchDate,
    }),
    ...(input.lostReason !== undefined && { lostReason: input.lostReason }),
  });
  if (!moved) {
    throw new NotFoundException(
      `${businessUnit} has no progress row on this opportunity`,
    );
  }

  await recomputeOpportunityRollup(db, id);
  return getById(db, id, userId, permissions);
}

export async function reorderCards(
  db: Db,
  userId: string,
  permissions: string[],
  input: ReorderOpportunityCardsInput,
) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);

  const ids = input.opportunityIds.map((oid) => {
    if (!oid) {
      throw new BadRequestException("Each card needs an opportunityId");
    }
    return oid;
  });

  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw new BadRequestException("Card order contains a repeated deal");
  }

  const visible = await repo.findManyByIds(db, unique, canSeeAll ? undefined : userId);
  if (visible.length !== unique.length) {
    throw new NotFoundException("One or more opportunities were not found");
  }

  return repo.reorderWithinStage(db, input.stageKey, ids);
}

export async function remove(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
) {
  await getById(db, id, userId, permissions);
  await repo.remove(db, id);
}

export async function archive(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
) {
  const existing = await getById(db, id, userId, permissions);
  return repo.update(db, id, {
    archivedAt: existing.archivedAt ?? new Date().toISOString(),
  });
}

export async function unarchive(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
) {
  await getById(db, id, userId, permissions);
  return repo.update(db, id, { archivedAt: null });
}

export async function listStageConfigs(db: Db) {
  return repo.listStageConfigs(db);
}

export async function bulkUpdateStageConfigs(
  db: Db,
  input: BulkUpdateStageConfigsInput,
) {
  return Promise.all(
    input.configs.map((c) =>
      repo.upsertStageConfig(db, c.key, {
        label: c.label,
        probability: c.probability,
        sortOrder: c.sortOrder,
        color: c.color,
      }),
    ),
  );
}

export async function bulkUpdateBusinessUnits(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkUpdateOpportunitiesInput,
): Promise<BulkApplyResult & { selected: number }> {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];

  const where = resolveBulkWhere(
    { ids: input.ids, allMatching: input.allMatching, filter: input.filter },
    ownerScope,
  );

  const rows = await repo.findIdsAndUnits(db, where, 500 + 1);
  if (rows.length > 500) {
    throw new BadRequestException(
      "Selection is too large (over 500 records). Narrow the filter and try again.",
    );
  }

  const result = await applyBulkBusinessUnits(
    rows.map((r) => ({ ...r, businessUnits: r.businessUnits ?? [] })),
    input.businessUnits.codes,
    input.businessUnits.mode,
    (oid, next) =>
      update(db, oid, userId, permissions, { businessUnits: next }, {
        suppressNotifications: true,
      }),
    { module: "opportunities", actorId: userId },
  );

  return { ...result, selected: rows.length };
}

export async function bulkUpdateFields(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkFieldUpdateOpportunitiesInput,
): Promise<BulkFieldResult & { selected: number }> {
  if (
    input.set.ownerId !== undefined &&
    !permissions.includes(PERMISSIONS.CRM_REASSIGN)
  ) {
    throw new ForbiddenException(
      "Reassigning owner in bulk requires the crm:reassign permission.",
    );
  }

  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];

  const where = resolveBulkWhere(
    { ids: input.ids, allMatching: input.allMatching, filter: input.filter },
    ownerScope,
  );

  const rows = await repo.findIdsForFieldSet(db, where, 500 + 1);
  if (rows.length > 500) {
    throw new BadRequestException(
      "Selection is too large (over 500 records). Narrow the filter and try again.",
    );
  }

  const result = await applyBulkFieldSet(
    rows.map((r) => ({ ...r, lifecycle: r.stage })),
    {
      ...input.set,
      lifecycle: input.set.stage,
    },
    {
      setOwner: (oid, ownerId) =>
        update(db, oid, userId, permissions, { ownerId }, { suppressNotifications: true }),
      archive: (oid) => archive(db, oid, userId, permissions),
      unarchive: (oid) => unarchive(db, oid, userId, permissions),
      setLifecycle: (oid, next) =>
        update(
          db,
          oid,
          userId,
          permissions,
          { stage: next as UpdateOpportunityInput["stage"] },
          { suppressNotifications: true },
        ),
    },
    { module: "opportunities", actorId: userId },
  );

  return { ...result, selected: rows.length };
}
