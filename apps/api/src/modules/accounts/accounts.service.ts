import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { syncAccountDeal } from "@/modules/accounts/account-deal.sync";
import { accountRepository } from "@/modules/accounts/accounts.repository";
import type {
  CreateAccountInput,
  ImportAccountsInput,
  ListAccountsQuery,
  ReorderAccountsInput,
  UpdateAccountInput,
} from "@/modules/accounts/accounts.validation";

// Form sends "" for unset date pickers; persist as null. Returns the
// parsed Date for valid YYYY-MM-DD strings.
function toDateOrNull(v: string | null | undefined): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class AccountService {
  // Default to owner scope; team-read permission widens access to all.
  async list(userId: string, permissions: string[], query: ListAccountsQuery) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await accountRepository.findMany(
      { ...filters, ownerScope },
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, permissions: string[]) {
    const account = await accountRepository.findById(id);
    if (!account) throw new NotFoundException("Account not found");

    const canSeeAll = permissions.includes("crm:team-read");
    if (!canSeeAll && account.ownerId !== userId) {
      throw new NotFoundException("Account not found");
    }
    return account;
  }

  // Domain-first account dedupe.
  // - domain present: hard reject if domain exists
  // - domain absent: case-insensitive name match → 409 with candidate unless
  //   the client passes `confirmCreate: true` to override
  async create(
    ownerId: string,
    permissions: string[],
    input: CreateAccountInput,
  ) {
    if (input.domain) {
      const existing = await accountRepository.findByDomain(input.domain);
      if (existing) {
        throw new ConflictException(
          `An account with domain "${input.domain}" already exists (id: ${existing.id}).`,
        );
      }
    } else if (!input.confirmCreate) {
      const candidate = await accountRepository.findByNameInsensitive(
        input.name,
      );
      if (candidate) {
        throw new ConflictException(
          `An account named "${candidate.name}" already exists (id: ${candidate.id}). Pass confirmCreate=true to create a separate account.`,
        );
      }
    }

    const { deal, ...accountFields } = input;

    const created = await accountRepository.create({
      name: accountFields.name,
      domain: accountFields.domain,
      industry: accountFields.industry,
      size: accountFields.size,
      country: accountFields.country,
      region: accountFields.region,
      website: accountFields.website,
      notes: accountFields.notes,
      totalUsers: accountFields.totalUsers,
      appUsers: accountFields.appUsers,
      picName: accountFields.picName ?? undefined,
      designation: accountFields.designation ?? undefined,
      department: accountFields.department ?? undefined,
      lastFollowUpDate:
        toDateOrNull(accountFields.lastFollowUpDate) ?? undefined,
      agreementSignedDate:
        toDateOrNull(accountFields.agreementSignedDate) ?? undefined,
      engagementType: accountFields.engagementType ?? undefined,
      uatStartDate: toDateOrNull(accountFields.uatStartDate) ?? undefined,
      uatEndDate: toDateOrNull(accountFields.uatEndDate) ?? undefined,
      blocker: accountFields.blocker ?? undefined,
      remarks: accountFields.remarks ?? undefined,
      owner: { connect: { id: ownerId } },
      partner: accountFields.partnerId
        ? { connect: { id: accountFields.partnerId } }
        : undefined,
    });

    await syncAccountDeal(created.id, created.name, ownerId, permissions, deal);

    const refreshed = await accountRepository.findById(created.id);
    return refreshed ?? created;
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateAccountInput,
  ) {
    await this.getById(id, userId, permissions);

    if (input.domain) {
      const existing = await accountRepository.findByDomain(input.domain);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Domain "${input.domain}" is already used by account ${existing.id}.`,
        );
      }
    }

    const { deal, ...accountFields } = input;

    await accountRepository.update(id, {
      ...(accountFields.name !== undefined && { name: accountFields.name }),
      ...(accountFields.domain !== undefined && {
        domain: accountFields.domain || null,
      }),
      ...(accountFields.industry !== undefined && {
        industry: accountFields.industry || null,
      }),
      ...(accountFields.size !== undefined && {
        size: accountFields.size || null,
      }),
      ...(accountFields.country !== undefined && {
        country: accountFields.country || null,
      }),
      ...(accountFields.region !== undefined && {
        region: accountFields.region || null,
      }),
      ...(accountFields.website !== undefined && {
        website: accountFields.website || null,
      }),
      ...(accountFields.notes !== undefined && {
        notes: accountFields.notes || null,
      }),
      ...(accountFields.totalUsers !== undefined && {
        totalUsers: accountFields.totalUsers,
      }),
      ...(accountFields.appUsers !== undefined && {
        appUsers: accountFields.appUsers,
      }),
      ...(accountFields.picName !== undefined && {
        picName: accountFields.picName || null,
      }),
      ...(accountFields.designation !== undefined && {
        designation: accountFields.designation || null,
      }),
      ...(accountFields.department !== undefined && {
        department: accountFields.department || null,
      }),
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
      ...(accountFields.blocker !== undefined && {
        blocker: accountFields.blocker || null,
      }),
      ...(accountFields.remarks !== undefined && {
        remarks: accountFields.remarks || null,
      }),
      ...(accountFields.partnerId !== undefined && {
        partner: accountFields.partnerId
          ? { connect: { id: accountFields.partnerId } }
          : { disconnect: true },
      }),
    });

    const accountName =
      accountFields.name ?? (await accountRepository.findById(id))?.name ?? "";
    await syncAccountDeal(id, accountName, userId, permissions, deal);

    const refreshed = await accountRepository.findById(id);
    return refreshed!;
  }

  // Persist the rep's manual order for the Accounts grid. Reps
  // without `crm:team-read` can only reorder their own rows; if any
  // submitted id falls outside that scope we 403 the whole batch so a
  // partial write can't leave the grid half-arranged. Admin / team-read
  // holders may reorder any subset.
  async reorder(
    userId: string,
    permissions: string[],
    input: ReorderAccountsInput,
  ) {
    const canReorderAll = permissions.includes("crm:team-read");
    if (!canReorderAll) {
      const owned = await accountRepository.findIdsByOwner(
        input.orderedIds,
        userId,
      );
      if (owned.length !== input.orderedIds.length) {
        throw new BadRequestException(
          "Reorder includes accounts you don't own. Drop the unowned rows or ask for team-read access.",
        );
      }
    }
    await accountRepository.reorder(input.orderedIds);
    return { success: true };
  }

  // Bulk import from the xlsx / csv import dialog. Each row goes
  // through the same `create()` path that the form uses, so the
  // domain-uniqueness + case-insensitive name dedupe rules still
  // apply. Rows that conflict (domain already taken, or name match
  // without confirmCreate=true) are counted under `skipped` rather
  // than failing the whole batch — the rep can re-export, fix the
  // duplicates, and re-import the deltas.
  async bulkCreate(
    userId: string,
    permissions: string[],
    input: ImportAccountsInput,
  ) {
    let created = 0;
    let skipped = 0;
    for (const row of input.rows) {
      try {
        await this.create(userId, permissions, {
          ...row,
          // Import always overrides the name-match prompt — the dialog
          // is a fire-and-forget batch path, not the per-row "did you
          // mean?" flow the form uses. Domain uniqueness still throws
          // and falls through to the `skipped` counter below.
          confirmCreate: true,
        });
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

  async delete(id: string, userId: string, permissions: string[]) {
    // getById enforces ownership / `crm:team-read`. We also pull the
    // row here so the audit log captures the name + owner *before* the
    // cascade fires — once the rows are gone we have no way to
    // reconstruct who deleted what.
    const account = await this.getById(id, userId, permissions);
    logger.info("CRM account deleted", {
      accountId: id,
      accountName: account.name,
      previousOwnerId: account.ownerId ?? null,
      deletedByUserId: userId,
    });
    try {
      return await accountRepository.delete(id);
    } catch (err) {
      // Postgres FK-violation surfaced through Prisma as P2003. The
      // 20260725 migration switched `crm_opportunities.account_id`
      // to ON DELETE CASCADE — this catch block stays as a belt-and-
      // braces guard for any future child relation that lands without
      // a Cascade hint (and to turn the generic 500 into a readable
      // 400 if the migration hasn't run yet on a stale env).
      const code = (err as { code?: string }).code;
      if (code === "P2003") {
        throw new BadRequestException(
          "Cannot delete account — it still has related records (opportunities, contacts, or activities). Remove those first.",
        );
      }
      throw err;
    }
  }
}

export const accountService = new AccountService();
