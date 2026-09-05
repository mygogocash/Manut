import { and, eq, isNull } from "drizzle-orm";
import { PERMISSIONS } from "@nexora/contracts";
import {
  STAGE_PROBABILITY_DEFAULTS,
  type OpportunityStage,
} from "@nexora/contracts/modules/opportunities/opportunities.constants";
import type {
  BulkFieldUpdateLeadsInput,
  BulkUpdateLeadsInput,
  ConvertLeadInput,
  CreateLeadInput,
  DisqualifyLeadInput,
  ListLeadsQuery,
  ListStaleLeadsQuery,
  UpdateLeadInput,
} from "@nexora/contracts/modules/leads/leads.validation";
import { STALE_LEAD_DAYS } from "@nexora/contracts/modules/leads/leads.validation";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import * as accountsRepo from "../accounts/accounts.repository";
import { applyBulkBusinessUnits } from "../crm-shared/bulk-apply";
import { applyBulkFieldSet } from "../crm-shared/bulk-field-set";
import { resolveBulkWhere } from "../crm-shared/bulk-selection";
import * as contactsRepo from "../contacts/contacts.repository";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as leadSourcesRepo from "../lead-sources/lead-sources.repository";
import * as opportunitiesRepo from "../opportunities/opportunities.repository";
import {
  ensureBusinessUnitRows,
  recomputeOpportunityRollup,
} from "../opportunities/opportunity-business-units.repository";
import * as repo from "./leads.repository";

export async function list(db: Db, userId: string, permissions: string[], query: ListLeadsQuery) {
  const { page, limit, ...filters } = query;
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];

  const { data, total } = await repo.findMany(db, { ...filters, ownerScope }, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function listStale(
  db: Db,
  userId: string,
  permissions: string[],
  query: ListStaleLeadsQuery,
) {
  const { page, limit, ...filters } = query;
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  const cutoff = new Date(Date.now() - STALE_LEAD_DAYS * 86_400_000).toISOString();

  const { data, total } = await repo.findStale(
    db,
    { ...filters, ownerScope, cutoff },
    page,
    limit,
  );

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    thresholdDays: STALE_LEAD_DAYS,
  };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const lead = await repo.findById(db, id);
  if (!lead) throw new NotFoundException("Lead not found");

  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canSeeAll && lead.ownerId !== userId) {
    throw new NotFoundException("Lead not found");
  }
  return lead;
}

async function assertSourceActive(db: Db, code: string) {
  const row = await leadSourcesRepo.findByCode(db, code);
  if (!row || !row.isActive) {
    throw new BadRequestException(`Source "${code}" is not an active lead source.`);
  }
}

export async function create(db: Db, ownerId: string, input: CreateLeadInput) {
  await assertSourceActive(db, input.source);
  return repo.create(db, {
    company: input.company,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    title: input.title ?? null,
    source: input.source,
    status: input.status,
    notes: input.notes ?? null,
    businessUnits: input.businessUnits ?? [],
    ownerId,
  });
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateLeadInput,
) {
  const existing = await getById(db, id, userId, permissions);

  if (existing.status === "converted" || existing.status === "disqualified") {
    throw new BadRequestException(
      `Cannot edit a ${existing.status} lead. Reopen via convert/disqualify endpoints.`,
    );
  }

  if (input.source !== undefined && input.source !== existing.source) {
    await assertSourceActive(db, input.source);
  }

  return repo.update(db, id, {
    ...(input.company !== undefined && { company: input.company }),
    ...(input.firstName !== undefined && { firstName: input.firstName }),
    ...(input.lastName !== undefined && { lastName: input.lastName }),
    ...(input.email !== undefined && { email: input.email || null }),
    ...(input.phone !== undefined && { phone: input.phone || null }),
    ...(input.title !== undefined && { title: input.title || null }),
    ...(input.source !== undefined && { source: input.source }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes || null }),
    ...(input.businessUnits !== undefined && { businessUnits: input.businessUnits }),
  });
}

export async function disqualify(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: DisqualifyLeadInput,
) {
  const existing = await getById(db, id, userId, permissions);

  if (existing.status === "converted") {
    throw new BadRequestException("Cannot disqualify a lead that has already been converted.");
  }
  if (existing.status === "disqualified") {
    throw new BadRequestException("Lead is already disqualified.");
  }

  return repo.update(db, id, {
    status: "disqualified",
    disqualifyReason: input.reason,
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

export async function convert(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: ConvertLeadInput,
) {
  const lead = await getById(db, id, userId, permissions);

  if (lead.status === "converted") {
    throw new BadRequestException("Lead is already converted.");
  }
  if (lead.status === "disqualified") {
    throw new BadRequestException("Cannot convert a disqualified lead.");
  }

  let effectiveOwnerId = lead.ownerId;
  if (input.ownerId !== undefined) {
    if (!permissions.includes(PERMISSIONS.CRM_REASSIGN)) {
      throw new ForbiddenException(
        "Changing owner on convert requires the crm:reassign permission.",
      );
    }
    effectiveOwnerId = input.ownerId;
  }

  return db.transaction(async (tx) => {
    let accountId: string;

    if (input.accountId) {
      const existing = await accountsRepo.findById(tx, input.accountId);
      if (!existing) throw new NotFoundException("Account not found");
      const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
      if (!canSeeAll && existing.ownerId !== userId) {
        throw new NotFoundException("Account not found");
      }
      accountId = existing.id;
    } else {
      const newAccount = input.newAccount ?? { name: lead.company };

      if (newAccount.domain) {
        const dup = await accountsRepo.findByDomain(tx, newAccount.domain);
        if (dup) {
          throw new ConflictException(
            `An account with domain "${newAccount.domain}" already exists (id: ${dup.id}).`,
          );
        }
      } else if (!input.confirmCreate) {
        const candidate = await accountsRepo.findByNameInsensitive(tx, newAccount.name);
        if (candidate) {
          throw new ConflictException(
            `An account named "${candidate.name}" already exists (id: ${candidate.id}). Pass accountId to attach or confirmCreate=true to create a separate account.`,
          );
        }
      }

      const created = await accountsRepo.create(tx, {
        name: newAccount.name,
        domain: newAccount.domain ?? null,
        industry: newAccount.industry ?? null,
        size: newAccount.size ?? null,
        country: newAccount.country ?? null,
        website: newAccount.website ?? null,
        businessUnits: lead.businessUnits ?? [],
        ownerId: effectiveOwnerId,
      });
      accountId = created!.id;
    }

    let contactId: string;

    if (input.contactId) {
      const existing = await contactsRepo.findById(tx, input.contactId);
      if (!existing) throw new NotFoundException("Contact not found");
      if (existing.accountId !== accountId) {
        throw new BadRequestException("Contact does not belong to the resolved account.");
      }
      contactId = existing.id;
    } else {
      const seed = input.newContact ?? {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        title: lead.title ?? undefined,
      };

      const existingCount = await contactsRepo.countForAccount(tx, accountId);
      const isPrimary = existingCount === 0;

      const created = await contactsRepo.create(tx, {
        accountId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email ?? null,
        phone: seed.phone ?? null,
        title: seed.title ?? null,
        notes: null,
        isPrimary,
      });
      contactId = created!.id;
    }

    const stage = input.opportunity.stage as OpportunityStage;
    const probabilityCustom = input.opportunity.probability !== undefined;
    const probability = probabilityCustom
      ? input.opportunity.probability!
      : STAGE_PROBABILITY_DEFAULTS[stage];

    const opportunity = await opportunitiesRepo.createForLeadConvert(tx, {
      name: input.opportunity.name,
      accountId,
      contactId,
      ownerId: effectiveOwnerId,
      stage,
      value: String(input.opportunity.value),
      currency: input.opportunity.currency,
      probability,
      probabilityCustom,
      closeDate: input.opportunity.closeDate ?? null,
      type: input.opportunity.type ?? null,
      businessUnits: lead.businessUnits ?? [],
    });

    if (!opportunity) throw new BadRequestException("Failed to create opportunity");

    await ensureBusinessUnitRows(tx, opportunity.id, lead.businessUnits ?? []);
    await recomputeOpportunityRollup(tx, opportunity.id);

    const updatedLead = await repo.update(tx, id, {
      status: "converted",
      convertedOpportunityId: opportunity.id,
      convertedAt: new Date().toISOString(),
    });

    await tx
      .update(schema.crmActivities)
      .set({ opportunityId: opportunity.id })
      .where(
        and(
          eq(schema.crmActivities.leadId, id),
          isNull(schema.crmActivities.opportunityId),
        ),
      );

    return {
      lead: updatedLead,
      accountId,
      contactId,
      opportunity,
    };
  });
}

export async function bulkUpdateBusinessUnits(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkUpdateLeadsInput,
) {
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

  const result = await applyBulkBusinessUnits(
    rows.map((r) => ({ id: r.id, businessUnits: r.businessUnits ?? [] })),
    input.businessUnits.codes,
    input.businessUnits.mode,
    (id, next) => update(db, id, userId, permissions, { businessUnits: next }),
    { module: "leads", actorId: userId },
  );

  return { ...result, selected: rows.length };
}

export async function bulkUpdateFields(
  db: Db,
  userId: string,
  permissions: string[],
  input: BulkFieldUpdateLeadsInput,
) {
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
    rows.map((r) => ({ ...r, lifecycle: r.status })),
    {
      ...input.set,
      lifecycle: (input.set as { stage?: string; status?: string }).status,
    },
    {
      setOwner: () => {
        throw new BadRequestException("A lead's owner cannot be reassigned. Convert it instead.");
      },
      archive: (rowId) => archive(db, rowId, userId, permissions),
      unarchive: (rowId) => unarchive(db, rowId, userId, permissions),
      setLifecycle: (rowId, next) =>
        update(db, rowId, userId, permissions, {
          status: next as UpdateLeadInput["status"],
        }),
    },
    { module: "leads", actorId: userId },
  );

  return { ...result, selected: rows.length };
}
