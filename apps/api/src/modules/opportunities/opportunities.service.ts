import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { sendEmail } from "@/infrastructure/email/email.service";
import {
  opportunityCreatedEmail,
  opportunityStageChangedEmail,
} from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import { accountRepository } from "@/modules/accounts/accounts.repository";
import { contactRepository } from "@/modules/contacts/contacts.repository";
import { crmSettingsRepository } from "@/modules/crm-settings/crm-settings.repository";
import { createExchangeRateService } from "@/modules/exchange-rates/exchange-rates.service";
import {
  type OpportunityStage,
  STAGE_PROBABILITY_DEFAULTS,
} from "@/modules/opportunities/opportunities.constants";
import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";
import type {
  BulkUpdateStageConfigsInput,
  CloseLostInput,
  CreateOpportunityInput,
  ListOpportunitiesQuery,
  ReopenOpportunityInput,
  ReorderWithinStageInput,
  UpdateOpportunityInput,
} from "@/modules/opportunities/opportunities.validation";

// Resolves the recipient list for an opportunity-related email. Reads
// the CRM team fan-out from the `crm_settings` singleton row at call
// time so admin edits in the Notification settings dialog take effect
// without a restart. The owner is appended conditionally — controlled
// by the relevant per-event "notify owner" toggle. Both lists are
// merged and deduped before being returned.
//
// Migration note: this replaced the legacy `CRM_NOTIFICATION_EMAILS`
// env var that used to gate this list. Existing deployments still
// carrying that env var will see it ignored — the DB row is source of
// truth from this PR onwards.
async function resolveRecipients(
  ownerEmail: string | undefined,
  notifyTeam: boolean,
  notifyOwner: boolean,
): Promise<string[]> {
  const settings = await crmSettingsRepository.getSettings();
  const out = new Set<string>();
  if (notifyTeam) {
    for (const addr of settings.notifyEmails) out.add(addr);
  }
  if (notifyOwner && ownerEmail) out.add(ownerEmail);
  return Array.from(out);
}

type OpportunityWithRelations = Awaited<
  ReturnType<typeof opportunityRepository.findById>
>;

async function notifyOpportunityCreated(
  opp: NonNullable<OpportunityWithRelations>,
  _ownerId: string,
): Promise<void> {
  const settings = await crmSettingsRepository.getSettings();
  const to = await resolveRecipients(
    opp.owner.email ?? undefined,
    settings.notifyOnCreate,
    settings.notifyOwnerOnCreate,
  );
  if (to.length === 0) return;
  const email = opportunityCreatedEmail({
    ownerName: opp.owner.name,
    accountName: opp.account.name,
    opportunityName: opp.name,
    stage: opp.stage,
    value: String(opp.value),
    currency: opp.currency,
    portalUrl: `${PORTAL_URL}/sales`,
  });
  try {
    await Promise.all(to.map((addr) => sendEmail({ to: addr, ...email })));
  } catch (err) {
    logger.warn("opportunity created email failed", { err });
  }
}

async function notifyOpportunityStageChanged(
  opp: NonNullable<OpportunityWithRelations>,
  fromStage: string,
  _actorId: string,
): Promise<void> {
  // Team fan-out on stage changes always honours `notifyOnCreate`
  // (it's the master CRM fan-out toggle); owner fan-out is gated by
  // its own per-event toggle so an owner can opt out of stage spam
  // while keeping the create-confirmation email.
  const settings = await crmSettingsRepository.getSettings();
  const to = await resolveRecipients(
    opp.owner.email ?? undefined,
    settings.notifyOnCreate,
    settings.notifyOwnerOnStageChange,
  );
  if (to.length === 0) return;
  const email = opportunityStageChangedEmail({
    ownerName: opp.owner.name,
    accountName: opp.account.name,
    opportunityName: opp.name,
    fromStage,
    toStage: opp.stage,
    value: String(opp.value),
    currency: opp.currency,
    portalUrl: `${PORTAL_URL}/sales`,
  });
  try {
    await Promise.all(to.map((addr) => sendEmail({ to: addr, ...email })));
  } catch (err) {
    logger.warn("opportunity stage-changed email failed", { err });
  }
}

export class OpportunityService {
  async list(
    userId: string,
    permissions: string[],
    query: ListOpportunitiesQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const { data, total } = await opportunityRepository.findMany(
      { ...filters, ownerScope },
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async pipeline(userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];
    return opportunityRepository.pipelineSummary({ ownerScope });
  }

  // Sales CRM dashboard data — flat opportunity rows joined with account
  // geo + reach metrics, owner-scoped exactly like the pipeline. Decimal
  // `value` is coerced to a number and dates to YYYY-MM-DD so the client
  // can aggregate without Prisma types leaking to the wire.
  async dashboard(userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];
    const rows = await opportunityRepository.dashboardRows({ ownerScope });
    const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      stage: r.stage,
      value: Number(r.value),
      currency: r.currency,
      probability: r.probability,
      launchDate: day(r.launchDate),
      revenueLaunchDate: day(r.revenueLaunchDate),
      accountId: r.account?.id ?? null,
      accountName: r.account?.name ?? null,
      country: r.account?.country ?? null,
      region: r.account?.region ?? null,
      industry: r.account?.industry ?? null,
      totalUsers: r.account?.totalUsers ?? null,
      appUsers: r.account?.appUsers ?? null,
      engagementType: r.account?.engagementType ?? null,
      ownerName: r.owner?.name ?? null,
    }));
  }

  // Distinct country / region values for
  // the pipeline-view filter selects. Scoped to the caller's owner set so
  // managers never see options from teams they cannot read.
  async filterOptions(userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];
    return opportunityRepository.filterOptions({ ownerScope });
  }

  // Single-currency aggregated forecast. Pulls
  // every active opportunity under the caller's scope, converts each
  // row's `value` to `reportCurrency` via the freshest exchange rate,
  // weights by `probability / 100`, and returns weighted + unweighted
  // totals. Rows whose source currency has no rate path to the report
  // currency are surfaced separately so the rep knows to ask an admin
  // to add a rate row.
  async forecast(
    userId: string,
    permissions: string[],
    reportCurrency: string,
  ) {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];
    const rows = await opportunityRepository.forecastRows({ ownerScope });

    const fx = createExchangeRateService();
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
      const lookup = await fx.resolveRate(fromCcy, target);
      const value = Number(row.value);

      if (lookup.source === "missing") {
        missingByCurrency.set(
          fromCcy,
          (missingByCurrency.get(fromCcy) ?? 0) + 1,
        );
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
      byStage: Array.from(byStage.values()).sort((a, b) =>
        a.stage.localeCompare(b.stage),
      ),
      missingRates: Array.from(missingByCurrency.entries())
        .map(([currency, count]) => ({ currency, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async getById(id: string, userId: string, permissions: string[]) {
    const opp = await opportunityRepository.findById(id);
    if (!opp) throw new NotFoundException("Opportunity not found");

    const canSeeAll = permissions.includes("crm:team-read");
    if (!canSeeAll && opp.ownerId !== userId) {
      throw new NotFoundException("Opportunity not found");
    }
    return opp;
  }

  async create(
    ownerId: string,
    permissions: string[],
    input: CreateOpportunityInput,
  ) {
    const canSeeAll = permissions.includes("crm:team-read");

    // Account must exist and be visible to the caller. Reps cannot create
    // opportunities under accounts they do not own.
    const account = await accountRepository.findById(input.accountId);
    if (!account || (!canSeeAll && account.ownerId !== ownerId)) {
      throw new NotFoundException("Account not found");
    }

    // Optional contact must belong to the same account.
    if (input.contactId) {
      const contact = await contactRepository.findById(input.contactId);
      if (!contact || contact.accountId !== input.accountId) {
        throw new BadRequestException(
          "Contact does not belong to the supplied account.",
        );
      }
    }

    // Probability handling: if the rep specified a value on
    // create, mark probabilityCustom = true so we never overwrite it on
    // future stage moves; otherwise snap to the stage default.
    const stage = input.stage as OpportunityStage;
    const probabilityCustom = input.probability !== undefined;
    const probability = probabilityCustom
      ? input.probability!
      : await this.getStageProbability(stage);

    const created = await opportunityRepository.create({
      name: input.name,
      account: { connect: { id: input.accountId } },
      contact: input.contactId
        ? { connect: { id: input.contactId } }
        : undefined,
      stage,
      value: input.value,
      currency: input.currency,
      probability,
      probabilityCustom,
      closeDate: input.closeDate ? new Date(input.closeDate) : undefined,
      launchDate: input.launchDate ? new Date(input.launchDate) : undefined,
      revenueLaunchDate: input.revenueLaunchDate
        ? new Date(input.revenueLaunchDate)
        : undefined,
      type: input.type,
      notes: input.notes,
      owner: { connect: { id: ownerId } },
    });

    // Fire a "new deal" email so the wider team learns about
    // the pipeline addition without watching the CRM all day. Send is
    // best-effort: persistence already succeeded.
    void notifyOpportunityCreated(created, ownerId).catch(() => {});

    return created;
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateOpportunityInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    // Closed-won / closed-lost rows
    // used to be edit-locked; reps had to call `reopen` first to fix a
    // typo in name/value/launchDate/notes. That created surprise errors
    // on legitimate corrections. We now allow field edits on terminal
    // rows; explicit stage transitions still fire the stage-changed
    // notification path, and `reopen` stays as the convenience endpoint
    // for kanban "drag back into pipeline" affordances.

    if (input.contactId !== undefined && input.contactId) {
      const contact = await contactRepository.findById(input.contactId);
      if (!contact || contact.accountId !== existing.accountId) {
        throw new BadRequestException(
          "Contact does not belong to this opportunity's account.",
        );
      }
    }

    // When the rep edits probability we flip the custom flag so
    // future stage changes leave the value alone. When they only change the
    // stage, snap probability to the stage default *unless* the row is
    // already custom.
    const stageChanged =
      input.stage !== undefined && input.stage !== existing.stage;
    const probabilitySupplied = input.probability !== undefined;

    let nextProbability: number | undefined;
    let nextProbabilityCustom: boolean | undefined;

    if (probabilitySupplied) {
      nextProbability = input.probability;
      nextProbabilityCustom = true;
    } else if (stageChanged && !existing.probabilityCustom) {
      nextProbability = await this.getStageProbability(
        input.stage as OpportunityStage,
      );
    }

    const updated = await opportunityRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.contactId !== undefined && {
        contact: input.contactId
          ? { connect: { id: input.contactId } }
          : { disconnect: true },
      }),
      ...(input.stage !== undefined && { stage: input.stage }),
      // A card that changes stage lands at the top of its new column.
      ...(stageChanged && { sortOrderWithinStage: 0 }),
      ...(input.value !== undefined && { value: input.value }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(nextProbability !== undefined && { probability: nextProbability }),
      ...(nextProbabilityCustom !== undefined && {
        probabilityCustom: nextProbabilityCustom,
      }),
      ...(input.closeDate !== undefined && {
        closeDate: input.closeDate ? new Date(input.closeDate) : null,
      }),
      ...(input.launchDate !== undefined && {
        launchDate: input.launchDate ? new Date(input.launchDate) : null,
      }),
      ...(input.revenueLaunchDate !== undefined && {
        revenueLaunchDate: input.revenueLaunchDate
          ? new Date(input.revenueLaunchDate)
          : null,
      }),
      ...(input.type !== undefined && { type: input.type || null }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    });

    // Notify on stage changes (existing.stage !== input.stage).
    // Best-effort send; persistence has already committed.
    if (stageChanged) {
      void notifyOpportunityStageChanged(updated, existing.stage, userId).catch(
        () => {},
      );
    }

    return updated;
  }

  // Convenience for the kanban "lose this deal" affordance — sets stage and
  // optional reason in one call so the UI doesn't have to chain PUTs.
  async closeLost(
    id: string,
    userId: string,
    permissions: string[],
    input: CloseLostInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    if (existing.stage === "closed_lost") {
      throw new BadRequestException("Opportunity is already closed_lost.");
    }
    // closed_won and live are both "won" terminal states — losing them
    // directly would skip the deliberate reopen step.
    if (existing.stage === "closed_won" || existing.stage === "live") {
      throw new BadRequestException(
        `Cannot mark a ${existing.stage} opportunity as lost. Reopen first.`,
      );
    }

    return opportunityRepository.update(id, {
      stage: "closed_lost",
      lostReason: input.lostReason ?? null,
      // Stage change → top of the destination column (matches the drag path).
      sortOrderWithinStage: 0,
      // Auto-set probability even if the rep had a custom value.
      // closed_lost is terminal — no future stage move benefits from the
      // custom probability.
      probability: await this.getStageProbability("closed_lost"),
    });
  }

  // Reopen takes a terminal closed_won / closed_lost row and
  // pushes it back into the active pipeline. We always clear lostReason,
  // and we snap probability to the new stage default *unless* the row was
  // probabilityCustom — same rule as `update`.
  async reopen(
    id: string,
    userId: string,
    permissions: string[],
    input: ReopenOpportunityInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    // closed_won / closed_lost / live are the "settled" stages a deal can be
    // pulled back into the active pipeline from.
    const REOPENABLE = ["closed_won", "closed_lost", "live"];
    if (!REOPENABLE.includes(existing.stage)) {
      throw new BadRequestException(
        "Only closed_won, closed_lost or live opportunities can be reopened.",
      );
    }

    const stage = input.stage as OpportunityStage;
    const nextProbability = existing.probabilityCustom
      ? undefined
      : await this.getStageProbability(stage);

    return opportunityRepository.update(id, {
      stage,
      lostReason: null,
      // Stage change → top of the destination column (matches the drag path).
      sortOrderWithinStage: 0,
      ...(nextProbability !== undefined && { probability: nextProbability }),
    });
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return opportunityRepository.delete(id);
  }

  // Persist the manual within-column order for one pipeline stage. Validates
  // that every id exists, lives in the target stage, and is inside the
  // caller's owner scope (reps without crm:team-read can only reorder their
  // own cards) before writing sortOrderWithinStage = index.
  async reorderWithinStage(
    userId: string,
    permissions: string[],
    input: ReorderWithinStageInput,
  ) {
    const { stageKey, orderedIds } = input;
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerId = canSeeAll ? undefined : userId;

    // Owner-scope the lookup: a foreign-owned id simply doesn't match, so a
    // non-existent id and a not-mine id yield the same NotFound — no
    // existence / stage / ownership oracle (mirrors getById's 404 posture).
    const rows = await opportunityRepository.findManyByIds(orderedIds, ownerId);
    if (rows.length !== orderedIds.length) {
      throw new NotFoundException(
        "One or more opportunities could not be found.",
      );
    }
    // These are all rows the caller owns/can see, so a stage mismatch is a
    // genuine client error, not a leak.
    if (rows.some((r) => r.stage !== stageKey)) {
      throw new BadRequestException(
        "All opportunities must belong to the target stage.",
      );
    }

    // Renumber the WHOLE stage (owner-scoped), not just the submitted page:
    // the submitted (loaded, reordered) cards take the top slots in the given
    // order; any remaining cards keep their current relative order beneath.
    // This stops a partially-loaded column from leaving un-loaded rows tied
    // at 0 above the hand-ordered ones (CLAUDE.md paginated-aggregate rule).
    const allIds = await opportunityRepository.listStageIdsOrdered(
      stageKey,
      ownerId,
    );
    const submitted = new Set(orderedIds);
    const finalOrder = [
      ...orderedIds,
      ...allIds.filter((id) => !submitted.has(id)),
    ];

    await opportunityRepository.reorderWithinStage(finalOrder);
    return { success: true, reordered: finalOrder.length };
  }

  // ─── Stage config (admin) ───────────────────────────────

  /**
   * Resolve the per-stage default probability. Reads from the
   * `opportunity_stage_config` table so admins can tune the snap
   * value without a code change. Falls back to the hardcoded stage
   * defaults if a row is missing — keeps create / update working
   * even on an empty table.
   */
  async getStageProbability(stage: OpportunityStage): Promise<number> {
    const row = await opportunityRepository.findStageConfig(stage);
    if (row) return row.probability;
    return STAGE_PROBABILITY_DEFAULTS[stage];
  }

  async listStageConfigs() {
    return opportunityRepository.listStageConfigs();
  }

  async bulkUpdateStageConfigs(input: BulkUpdateStageConfigsInput) {
    // Upsert every row in the payload. The validation enum already
    // restricts `key` to canonical stage codes so admins can't smuggle
    // arbitrary new stages through this endpoint.
    const updated = await Promise.all(
      input.configs.map((c) =>
        opportunityRepository.upsertStageConfig(c.key, {
          label: c.label,
          probability: c.probability,
          sortOrder: c.sortOrder,
          color: c.color,
        }),
      ),
    );
    return updated;
  }
}

export const opportunityService = new OpportunityService();
