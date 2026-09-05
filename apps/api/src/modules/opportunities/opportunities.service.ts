import { Prisma } from "@nexora/database";

import {
  BadRequestException,
  ForbiddenException,
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
import { BUSINESS_UNIT_UNASSIGNED } from "@/modules/business-units/business-units.validation";
import { contactRepository } from "@/modules/contacts/contacts.repository";
import { crmSettingsRepository } from "@/modules/crm-settings/crm-settings.repository";
import {
  applyBulkBusinessUnits,
  type BulkApplyResult,
} from "@/modules/crm-shared/bulk-apply";
import {
  applyBulkFieldSet,
  type BulkFieldResult,
} from "@/modules/crm-shared/bulk-field-set";
import { resolveBulkWhere } from "@/modules/crm-shared/bulk-selection";
import type { DealFieldPatch } from "@/modules/crm-shared/opportunity-push-down";
import { createExchangeRateService } from "@/modules/exchange-rates/exchange-rates.service";
import {
  type OpportunityStage,
  STAGE_PROBABILITY_DEFAULTS,
} from "@/modules/opportunities/opportunities.constants";
import {
  buildOpportunityWhere,
  opportunityRepository,
} from "@/modules/opportunities/opportunities.repository";
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
} from "@/modules/opportunities/opportunities.validation";
import { moveBusinessUnitRow } from "@/modules/opportunities/opportunity-business-unit-moves";
import {
  ensureBusinessUnitRows,
  listBusinessUnitRows,
  pushDealFieldsToBusinessUnits,
  recomputeOpportunityRollup,
} from "@/modules/opportunities/opportunity-business-units.repository";

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

  async pipeline(
    userId: string,
    permissions: string[],
    filters: PipelineQuery = {},
  ) {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];
    return opportunityRepository.pipelineSummary({ ownerScope }, filters);
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
      businessUnits: r.businessUnits,
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

  // BD-feedback (Vivek, May 2026) — distinct country / region values for
  // the pipeline-view filter selects. Scoped to the caller's owner set so
  // managers never see options from teams they cannot read.
  async filterOptions(userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];
    return opportunityRepository.filterOptions({ ownerScope });
  }

  // PRD §11.5 follow-up — single-currency aggregated forecast. Pulls
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

    // Lazy seed, mirroring projectRepository's native-mirror heal: a deal
    // that predates the child tables gets its rows on first open, instead
    // of from a boot-time bulk writer racing live traffic. Idempotent — a
    // deal already in step costs one extra count query.
    //
    // A freshly SEEDED deal needs no recompute: its rows reproduce the deal
    // exactly, so the roll-up is the identity. Only a sync that actually
    // added or dropped a unit changes what the deal should report.
    const ensured = await ensureBusinessUnitRows(id, opp.businessUnits);
    if (
      ensured.mode === "synced" &&
      (ensured.added.length > 0 || ensured.removed.length > 0)
    ) {
      await recomputeOpportunityRollup(id);
      return (await opportunityRepository.findById(id)) ?? opp;
    }

    return opp;
  }

  async create(
    ownerId: string,
    permissions: string[],
    input: CreateOpportunityInput,
  ) {
    const canSeeAll = permissions.includes("crm:team-read");

    // Create-on-behalf-of: only a team-read holder may name another owner.
    // Silently ignored otherwise — a 403 here would turn a stale UI payload
    // into a hard failure for ordinary reps, and falling back to the actor
    // is what every create did before the field existed.
    const effectiveOwnerId =
      canSeeAll && input.ownerId ? input.ownerId : ownerId;

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

    // PRD §11.4 probability handling. If the rep specified a value on
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
      // Business-unit tags. Absent → [] via the schema default, so an
      // untagged deal simply shows under "Unassigned".
      businessUnits: input.businessUnits ?? [],
      legacyDealId: input.legacyDealId,
      owner: { connect: { id: effectiveOwnerId } },
    });

    // A brand-new deal has no child rows, so its tags are SEEDED from the
    // deal rather than treated as newly added units — see
    // ensureBusinessUnitRows. Nothing is pushed down here: the seeded rows
    // already reproduce the deal.
    const fresh =
      (await this.syncBusinessUnitsAfterWrite(created.id, {
        tagOrder: input.businessUnits ?? [],
      })) ?? created;

    // BD-feedback — fire a "new deal" email so the wider team learns about
    // the pipeline addition without watching the CRM all day. Send is
    // best-effort: persistence already succeeded. Emails the re-read row:
    // `created` predates the roll-up and would report the pre-roll-up stage.
    void notifyOpportunityCreated(fresh, ownerId).catch(() => {});

    return fresh;
  }

  /**
   * Keep the child rows and the deal roll-up in step after a deal-level write.
   *
   * The order is the whole point, and it is why PR1's wiring was reverted:
   *
   * 1. Reconcile the tag set, so a newly tagged unit exists before anything
   *    reads it. `ensureBusinessUnitRows` decides whether this deal is being
   *    seeded from itself (no rows yet) or gaining a unit (rows already
   *    there) — two rules that look alike and are not.
   * 2. Push the edit DOWN onto the rows. Skipped for a freshly seeded deal:
   *    its rows already reproduce the deal, so re-splitting a value that is
   *    already right is pure risk.
   * 3. Recompute. Running this before step 2 reads stale rows and overwrites
   *    the very write it was meant to reflect.
   *
   * Returns the re-read deal, because the recompute wrote the derived fields
   * on that row and any copy taken earlier is stale.
   */
  private async syncBusinessUnitsAfterWrite(
    id: string,
    opts: {
      tagOrder?: readonly string[];
      patch?: DealFieldPatch;
      stageAppliesToEveryUnit?: boolean;
    },
  ) {
    let seeded = false;
    if (opts.tagOrder !== undefined) {
      const ensured = await ensureBusinessUnitRows(id, opts.tagOrder);
      seeded = ensured.mode === "seeded";
    }

    const patch = opts.patch;
    const hasPatch = patch !== undefined && Object.keys(patch).length > 0;
    if (hasPatch && !seeded) {
      await pushDealFieldsToBusinessUnits(id, patch, {
        stageAppliesToEveryUnit: opts.stageAppliesToEveryUnit ?? false,
      });
    }

    if (opts.tagOrder === undefined && !hasPatch) return null;

    await recomputeOpportunityRollup(id);
    return opportunityRepository.findById(id);
  }

  /**
   * The per-unit fields an update touched, as a push-down patch.
   *
   * Only keys actually present in the input appear, so an unrelated edit
   * (a rename) produces an empty patch and leaves every unit alone.
   */
  private dealFieldPatchFromUpdate(
    input: UpdateOpportunityInput,
    derived: { probability?: number; probabilityCustom?: boolean },
  ): DealFieldPatch {
    return {
      ...(input.stage !== undefined && { stage: input.stage }),
      ...(derived.probability !== undefined && {
        probability: derived.probability,
      }),
      ...(derived.probabilityCustom !== undefined && {
        probabilityCustom: derived.probabilityCustom,
      }),
      ...(input.value !== undefined && {
        value: new Prisma.Decimal(input.value),
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
    };
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateOpportunityInput,
    /**
     * `suppressNotifications` is set by the bulk path only.
     *
     * A stage change emails the BD distribution list per deal, so moving fifty
     * deals would send fifty emails. The bulk endpoint reports its outcome in
     * the response instead.
     *
     * Deliberately NOT replaced by a single summary email: that would need a
     * new templateId registered on the OneWave email service, and an
     * unregistered template fails silently with TEMPLATE_NOT_FOUND rather than
     * erroring — so inventing one here would look like it worked and send
     * nothing. Adding the summary is a follow-up that starts with registering
     * the template.
     */
    options?: { suppressNotifications?: boolean },
  ) {
    const existing = await this.getById(id, userId, permissions);

    // BD-feedback (Vivek, May 2026) — closed_won / closed_lost rows
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

    // PRD §11.4 — when the rep edits probability we flip the custom flag so
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
        // Re-arm the close-date reminder ladder — fired "close-*" markers
        // were tied to the old date (generalized CRM deadline cron).
        remindersSent: [],
        lastReminderSentAt: null,
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
      // Reassign-on-update, same gate as create-on-behalf-of: only a
      // team-read holder, silently ignored otherwise. The migration's
      // stub-transform path (an account's auto-spawned deal becoming the
      // migrated one) is what needs it.
      ...(input.ownerId !== undefined &&
        permissions.includes("crm:team-read") && {
          owner: { connect: { id: input.ownerId } },
        }),
      ...(input.legacyDealId !== undefined && {
        legacyDealId: input.legacyDealId,
      }),
      // A supplied array REPLACES the tag set (that is what the multi-select
      // sends); omitted leaves the existing tags alone.
      ...(input.businessUnits !== undefined && {
        businessUnits: input.businessUnits,
      }),
    });

    const fresh =
      (await this.syncBusinessUnitsAfterWrite(id, {
        // Omitted tags leave the unit set alone; a supplied array replaces it.
        ...(input.businessUnits !== undefined && {
          tagOrder: input.businessUnits,
        }),
        patch: this.dealFieldPatchFromUpdate(input, {
          probability: nextProbability,
          probabilityCustom: nextProbabilityCustom,
        }),
      })) ?? updated;

    // BD-feedback — notify on stage changes (existing.stage !== input.stage).
    // Best-effort send; persistence has already committed.
    if (stageChanged && !options?.suppressNotifications) {
      void notifyOpportunityStageChanged(fresh, existing.stage, userId).catch(
        () => {},
      );
    }

    return fresh;
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

    const lostReason = input.lostReason ?? null;
    // Auto-set probability per §11.4 even if the rep had a custom value.
    // closed_lost is terminal — no future stage move benefits from the
    // custom probability.
    const probability = await this.getStageProbability("closed_lost");

    const updated = await opportunityRepository.update(id, {
      stage: "closed_lost",
      lostReason,
      // Stage change → top of the destination column (matches the drag path).
      sortOrderWithinStage: 0,
      probability,
    });

    // Losing the DEAL settles every unit. Pushing closed_lost onto only the
    // least-advanced one would leave a sibling defining the roll-up — and
    // since closed_lost sorts LAST, the deal would report that sibling's
    // stage and the action would silently not take.
    return (
      (await this.syncBusinessUnitsAfterWrite(id, {
        patch: { stage: "closed_lost", probability, lostReason },
        stageAppliesToEveryUnit: true,
      })) ?? updated
    );
  }

  // PRD §11.4 — reopen takes a terminal closed_won / closed_lost row and
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

    const updated = await opportunityRepository.update(id, {
      stage,
      lostReason: null,
      // Stage change → top of the destination column (matches the drag path).
      sortOrderWithinStage: 0,
      ...(nextProbability !== undefined && { probability: nextProbability }),
    });

    // Reopening pulls the whole deal back, so every unit comes with it —
    // the mirror image of closeLost.
    return (
      (await this.syncBusinessUnitsAfterWrite(id, {
        patch: {
          stage,
          lostReason: null,
          ...(nextProbability !== undefined && {
            probability: nextProbability,
          }),
        },
        stageAppliesToEveryUnit: true,
      })) ?? updated
    );
  }

  // ── Per-business-unit board ─────────────────────────────────────────────

  /**
   * One deal's per-unit rows, for the edit form's stage-per-unit table.
   *
   * Routed through getById so the caller's ownership is enforced by the same
   * 404-not-403 posture as every other read — AND so the lazy seed runs
   * first: a deal that has never been written still returns a complete row
   * per tag rather than an empty table the form would render as "no units".
   */
  async businessUnitsForDeal(
    id: string,
    userId: string,
    permissions: string[],
  ) {
    await this.getById(id, userId, permissions);
    return listBusinessUnitRows(id);
  }

  /**
   * Move or edit ONE unit's progress on a deal — what a card drag calls.
   *
   * Not `update({ stage })`: that writes the deal, which under the roll-up
   * means moving whichever unit is least advanced, so dragging one card
   * would move a different one.
   */
  async moveBusinessUnit(
    id: string,
    businessUnit: string,
    userId: string,
    permissions: string[],
    input: MoveBusinessUnitInput,
  ) {
    // Also lazily seeds the child rows, so a synthesized card is backed by
    // a real row by the time the move runs.
    const deal = await this.getById(id, userId, permissions);

    // The Unassigned column holds deals with no units at all, so there is
    // no child row to move — that card IS the deal.
    if (businessUnit === BUSINESS_UNIT_UNASSIGNED) {
      if (input.stage === undefined) return deal;
      return this.update(id, userId, permissions, {
        stage: input.stage,
      } as UpdateOpportunityInput);
    }

    if (!deal.businessUnits.includes(businessUnit)) {
      throw new NotFoundException(
        `${businessUnit} is not a business unit on this opportunity`,
      );
    }

    const moved = await moveBusinessUnitRow(id, businessUnit, {
      ...(input.stage !== undefined && { stage: input.stage }),
      ...(input.probability !== undefined && {
        probability: input.probability,
      }),
      ...(input.value !== undefined && {
        value: new Prisma.Decimal(input.value),
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
      ...(input.lostReason !== undefined && { lostReason: input.lostReason }),
    });
    if (!moved) {
      throw new NotFoundException(
        `${businessUnit} has no progress row on this opportunity`,
      );
    }

    await recomputeOpportunityRollup(id);
    return this.getById(id, userId, permissions);
  }

  /**
   * Write a column's manual card order.
   *
   * Every deal referenced is re-fetched under the caller's owner scope
   * first: without that, a rep could reorder — and so learn the ids of —
   * cards on deals they cannot read. The repository writer takes the ids on
   * trust precisely because this check has to happen at the scoped layer.
   */
  async reorderCards(
    userId: string,
    permissions: string[],
    input: ReorderOpportunityCardsInput,
  ) {
    const canSeeAll = permissions.includes("crm:team-read");

    // zod validates the array as required and its members as non-empty. They
    // read as optional here only because this workspace compiles with
    // `strict: false`, which degrades z.infer — so narrow rather than cast.
    const ids = input.opportunityIds.map((id) => {
      if (!id) {
        throw new BadRequestException("Each card needs an opportunityId");
      }
      return id;
    });

    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      // A repeated id would be written twice and land on whichever index came
      // last, silently producing an order the caller did not ask for.
      throw new BadRequestException("Card order contains a repeated deal");
    }

    const visible = await opportunityRepository.findManyByIds(
      unique,
      canSeeAll ? undefined : userId,
    );
    if (visible.length !== unique.length) {
      throw new NotFoundException("One or more opportunities were not found");
    }

    return opportunityRepository.reorderWithinStage(input.stageKey, ids);
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return opportunityRepository.delete(id);
  }

  // Reversible archive — orthogonal to stage/status. Reuses the same
  // owner-or-team-read guard as update/delete via getById (a rep can only
  // archive their own deals; a crm:team-read holder can archive any), so no
  // new permission is minted. Idempotent: re-archiving keeps the original
  // archive time.
  async archive(id: string, userId: string, permissions: string[]) {
    const existing = await this.getById(id, userId, permissions);
    return opportunityRepository.update(id, {
      archivedAt: existing.archivedAt ?? new Date(),
    });
  }

  async unarchive(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return opportunityRepository.update(id, { archivedAt: null });
  }

  // ─── Stage config (admin) ───────────────────────────────

  /**
   * Resolve the per-stage default probability. Reads from the
   * `opportunity_stage_config` table so admins can tune the snap
   * value without a code change. Falls back to the hardcoded PRD §11.4
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

  /**
   * Bulk business-unit assignment.
   *
   * Selection is either ticked ids or "all matching the current filter",
   * resolved by `resolveBulkWhere` through the SAME where-builder the list
   * uses, with owner scope ANDed in both modes so a caller without
   * `crm:team-read` can never touch another rep's rows.
   *
   * For an opportunity this is the load-bearing part: `update` routes through
   * `syncBusinessUnitsAfterWrite`, which seeds the per-unit child rows for a
   * newly tagged deal, pushes deal fields down, then recomputes the roll-up —
   * in that order. A bulk `updateMany` on the tag array would skip all three
   * and leave the new unit with no row on the per-unit board. That is the
   * corruption PR1 was reverted for; do not shortcut it.
   *
   * Rows already carrying the requested set are skipped, not rewritten.
   */
  async bulkUpdateBusinessUnits(
    userId: string,
    permissions: string[],
    input: BulkUpdateOpportunitiesInput,
  ): Promise<BulkApplyResult & { selected: number }> {
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const where = resolveBulkWhere(
      { ids: input.ids, allMatching: input.allMatching, filter: input.filter },
      buildOpportunityWhere,
      ownerScope,
    );

    // Fetch one past the cap so an over-large selection is detected rather
    // than silently truncated.
    const rows = await opportunityRepository.findIdsAndUnits(where, 500 + 1);
    if (rows.length > 500) {
      throw new BadRequestException(
        "Selection is too large (over 500 records). Narrow the filter and try again.",
      );
    }

    const result = await applyBulkBusinessUnits(
      rows,
      input.businessUnits.codes,
      input.businessUnits.mode,
      (id, next) =>
        this.update(id, userId, permissions, { businessUnits: next }),
      { module: "opportunities", actorId: userId },
    );

    return { ...result, selected: rows.length };
  }

  /**
   * Bulk owner reassignment and archive/unarchive.
   *
   * Same selection contract as `bulkUpdateBusinessUnits`. Each write reuses the
   * single-record `update` / `archive` / `unarchive`, so per-row ownership
   * checks and any side effects keep running.
   *
   * `crm:reassign` is enforced HERE rather than on the route: the route's
   * `requirePermission` cannot express "only when `set.ownerId` is present", so
   * a caller may archive with `crm:update` alone but must hold `crm:reassign`
   * to move ownership.
   */
  async bulkUpdateFields(
    userId: string,
    permissions: string[],
    input: BulkFieldUpdateOpportunitiesInput,
  ): Promise<BulkFieldResult & { selected: number }> {
    if (
      input.set.ownerId !== undefined &&
      !permissions.includes("crm:reassign")
    ) {
      throw new ForbiddenException(
        "Reassigning owner in bulk requires the crm:reassign permission.",
      );
    }

    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const where = resolveBulkWhere(
      { ids: input.ids, allMatching: input.allMatching, filter: input.filter },
      buildOpportunityWhere,
      ownerScope,
    );

    const rows = await opportunityRepository.findIdsForFieldSet(where, 500 + 1);
    if (rows.length > 500) {
      throw new BadRequestException(
        "Selection is too large (over 500 records). Narrow the filter and try again.",
      );
    }

    const result = await applyBulkFieldSet(
      rows.map((r) => ({ ...r, lifecycle: r.stage })),
      {
        ...input.set,
        lifecycle: (input.set as { stage?: string; status?: string }).stage,
      },
      {
        setOwner: (id, ownerId) =>
          this.update(id, userId, permissions, { ownerId }),
        archive: (id) => this.archive(id, userId, permissions),
        unarchive: (id) => this.unarchive(id, userId, permissions),
        setLifecycle: (id, next) =>
          this.update(
            id,
            userId,
            permissions,
            { stage: next as UpdateOpportunityInput["stage"] },
            // One click moving fifty deals would otherwise send fifty emails to
            // the BD list.
            { suppressNotifications: true },
          ),
      },
      { module: "opportunities", actorId: userId },
    );

    return { ...result, selected: rows.length };
  }
}

export const opportunityService = new OpportunityService();
