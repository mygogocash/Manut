import { PERMISSIONS } from "@nexora/contracts";
import type {
  BulkFieldUpdateAccountsInput,
  BulkUpdateAccountsInput,
  CreateAccountInput,
  ImportAccountsInput,
  ListAccountsQuery,
  ReorderAccountsInput,
  UpdateAccountInput,
} from "@nexora/contracts/modules/accounts/accounts.validation";
import type { Db } from "@nexora/db";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import { applyBulkBusinessUnits, type BulkApplyResult } from "../crm-shared/bulk-apply";
import { applyBulkFieldSet, type BulkFieldResult } from "../crm-shared/bulk-field-set";
import { resolveBulkWhere } from "../crm-shared/bulk-selection";
import { syncAccountDeal } from "./account-deal.sync";
import * as repo from "./accounts.repository";

function toDateOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : v.slice(0, 10);
}

export async function list(
  db: Db,
  userId: string,
  permissions: string[],
  query: ListAccountsQuery,
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

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const account = await repo.findById(db, id);
  if (!account) throw new NotFoundException("Account not found");
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canSeeAll && account.ownerId !== userId) {
    throw new NotFoundException("Account not found");
  }
  return account;
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

export async function create(
  db: Db,
  ownerId: string,
  permissions: string[],
  input: CreateAccountInput,
) {
  if (input.domain) {
    const existing = await repo.findByDomain(db, input.domain);
    if (existing) {
      throw new ConflictException(
        `An account with domain "${input.domain}" already exists (id: ${existing.id}).`,
      );
    }
  } else if (!input.confirmCreate) {
    const candidate = await repo.findByNameInsensitive(db, input.name);
    if (candidate) {
      throw new ConflictException(
        `An account named "${candidate.name}" already exists (id: ${candidate.id}). Pass confirmCreate=true to create a separate account.`,
      );
    }
  }

  const { deal, ...accountFields } = input;
  const effectiveOwnerId =
    permissions.includes(PERMISSIONS.CRM_TEAM_READ) && accountFields.ownerId
      ? accountFields.ownerId
      : ownerId;

  const created = await repo.create(db, {
    name: accountFields.name,
    domain: accountFields.domain ?? null,
    industry: accountFields.industry ?? null,
    size: accountFields.size ?? null,
    country: accountFields.country ?? null,
    region: accountFields.region ?? null,
    website: accountFields.website ?? null,
    notes: accountFields.notes ?? null,
    totalUsers: accountFields.totalUsers ?? null,
    appUsers: accountFields.appUsers ?? null,
    picName: accountFields.picName ?? null,
    designation: accountFields.designation ?? null,
    department: accountFields.department ?? null,
    lastFollowUpDate: toDateOrNull(accountFields.lastFollowUpDate),
    agreementSignedDate: toDateOrNull(accountFields.agreementSignedDate),
    engagementType: accountFields.engagementType ?? null,
    uatStartDate: toDateOrNull(accountFields.uatStartDate),
    uatEndDate: toDateOrNull(accountFields.uatEndDate),
    blocker: accountFields.blocker ?? null,
    remarks: accountFields.remarks ?? null,
    ownerId: effectiveOwnerId,
    partnerId: accountFields.partnerId ?? null,
    businessUnits: accountFields.businessUnits ?? [],
  });

  await syncAccountDeal(db, created!.id, created!.name, effectiveOwnerId, deal);
  return (await repo.findById(db, created!.id))!;
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateAccountInput,
) {
  await getById(db, id, userId, permissions);

  if (input.domain) {
    const existing = await repo.findByDomain(db, input.domain);
    if (existing && existing.id !== id) {
      throw new ConflictException(
        `Domain "${input.domain}" is already used by account ${existing.id}.`,
      );
    }
  }

  const { deal, ...accountFields } = input;
  await repo.update(db, id, {
    ...(accountFields.name !== undefined && { name: accountFields.name }),
    ...(accountFields.domain !== undefined && { domain: accountFields.domain || null }),
    ...(accountFields.industry !== undefined && { industry: accountFields.industry || null }),
    ...(accountFields.size !== undefined && { size: accountFields.size || null }),
    ...(accountFields.country !== undefined && { country: accountFields.country || null }),
    ...(accountFields.region !== undefined && { region: accountFields.region || null }),
    ...(accountFields.website !== undefined && { website: accountFields.website || null }),
    ...(accountFields.notes !== undefined && { notes: accountFields.notes || null }),
    ...(accountFields.totalUsers !== undefined && { totalUsers: accountFields.totalUsers }),
    ...(accountFields.appUsers !== undefined && { appUsers: accountFields.appUsers }),
    ...(accountFields.picName !== undefined && { picName: accountFields.picName || null }),
    ...(accountFields.designation !== undefined && {
      designation: accountFields.designation || null,
    }),
    ...(accountFields.department !== undefined && { department: accountFields.department || null }),
    ...(accountFields.lastFollowUpDate !== undefined && {
      lastFollowUpDate: toDateOrNull(accountFields.lastFollowUpDate),
    }),
    ...(accountFields.agreementSignedDate !== undefined && {
      agreementSignedDate: toDateOrNull(accountFields.agreementSignedDate),
    }),
    ...(accountFields.engagementType !== undefined && {
      engagementType: accountFields.engagementType || null,
    }),
    ...(accountFields.uatStartDate !== undefined && {
      uatStartDate: toDateOrNull(accountFields.uatStartDate),
    }),
    ...(accountFields.uatEndDate !== undefined && {
      uatEndDate: toDateOrNull(accountFields.uatEndDate),
    }),
    ...(accountFields.blocker !== undefined && { blocker: accountFields.blocker || null }),
    ...(accountFields.remarks !== undefined && { remarks: accountFields.remarks || null }),
    ...(accountFields.businessUnits !== undefined && {
      businessUnits: accountFields.businessUnits,
    }),
    ...(accountFields.ownerId !== undefined && { ownerId: accountFields.ownerId }),
    ...(accountFields.partnerId !== undefined && {
      partnerId: accountFields.partnerId || null,
    }),
  });

  const accountName =
    accountFields.name ?? (await repo.findById(db, id))?.name ?? "";
  await syncAccountDeal(db, id, accountName, userId, deal);
  return (await repo.findById(db, id))!;
}

export async function reorder(
  db: Db,
  userId: string,
  permissions: string[],
  input: ReorderAccountsInput,
) {
  const canReorderAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canReorderAll) {
    const owned = await repo.findIdsByOwner(db, input.orderedIds, userId);
    if (owned.length !== input.orderedIds.length) {
      throw new BadRequestException(
        "Reorder includes accounts you don't own. Drop the unowned rows or ask for team-read access.",
      );
    }
  }
  await repo.reorder(db, input.orderedIds);
  return { success: true };
}

export async function bulkCreate(
  db: Db,
  userId: string,
  permissions: string[],
  input: ImportAccountsInput,
) {
  let created = 0;
  let skipped = 0;
  for (const row of input.rows) {
    try {
      await create(db, userId, permissions, { ...row, confirmCreate: true });
      created++;
    } catch (err) {
      if (err instanceof ConflictException) {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  return { created, skipped };
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  try {
    await repo.remove(db, id);
  } catch {
    throw new BadRequestException(
      "Cannot delete account — it still has related records (opportunities, contacts, or activities). Remove those first.",
    );
  }
}

export async function bulkUpdateBusinessUnits(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkUpdateAccountsInput,
): Promise<BulkApplyResult & { selected: number }> {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  const filters = resolveBulkWhere(
    { ids: input.ids, allMatching: input.allMatching, filter: input.filter },
    ownerScope,
  );
  const rows = await repo.findIdsAndUnits(db, filters, 501);
  if (rows.length > 500) {
    throw new BadRequestException(
      "Selection is too large (over 500 records). Narrow the filter and try again.",
    );
  }
  const normalized = rows.map((r) => ({
    id: r.id,
    businessUnits: r.businessUnits ?? [],
  }));
  const result = await applyBulkBusinessUnits(
    normalized,
    input.businessUnits.codes,
    input.businessUnits.mode,
    (id, next) => update(db, id, userId, permissions, { businessUnits: next }),
    { module: "accounts", actorId: userId },
  );
  return { ...result, selected: rows.length };
}

export async function bulkUpdateFields(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkFieldUpdateAccountsInput,
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
  const filters = resolveBulkWhere(
    { ids: input.ids, allMatching: input.allMatching, filter: input.filter },
    ownerScope,
  );
  const rows = await repo.findIdsForFieldSet(db, filters, 501);
  if (rows.length > 500) {
    throw new BadRequestException(
      "Selection is too large (over 500 records). Narrow the filter and try again.",
    );
  }
  const result = await applyBulkFieldSet(
    rows.map((r) => ({ ...r, lifecycle: "" })),
    input.set,
    {
      setOwner: (id, ownerId) => update(db, id, userId, permissions, { ownerId }),
      archive: (id) => archive(db, id, userId, permissions),
      unarchive: (id) => unarchive(db, id, userId, permissions),
    },
    { module: "accounts", actorId: userId },
  );
  return { ...result, selected: rows.length };
}
