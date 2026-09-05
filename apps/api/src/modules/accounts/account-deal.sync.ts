import type { CreateAccountInput } from "@/modules/accounts/accounts.validation";
import type { OpportunityStage } from "@/modules/opportunities/opportunities.constants";
import { STAGE_PROBABILITY_DEFAULTS } from "@/modules/opportunities/opportunities.constants";
import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";
import { opportunityService } from "@/modules/opportunities/opportunities.service";

type DealInput = NonNullable<CreateAccountInput["deal"]>;

function launchDateValue(raw: string | null | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (raw === "" || raw === null) return "";
  return raw;
}

/**
 * Upsert the account's primary opportunity so the Pipeline kanban
 * and the Accounts list stay aligned.
 *
 * BD feedback (Vivek, May 2026): every Account is by definition a
 * deal we're tracking, so the previous "only sync when the deal
 * subsection has at least one filled field" gate was the wrong
 * default — it left Accounts orphaned from the Pipeline and made
 * the totals on the two surfaces disagree.
 *
 * New behaviour:
 *   - On Account create with no deal data → stub Opportunity at
 *     `qualified` / $0 USD / default probability. The rep can fill
 *     in real numbers from the Account form later, or from the
 *     Pipeline detail sheet directly.
 *   - On Account create/update with deal data → upsert against the
 *     supplied fields (same code path as before).
 *   - If the Account already has an Opportunity and no deal fields
 *     are touched on update → no-op (don't clobber the rep's edits).
 *
 * The 0007 follow-up migration backfills a stub Opportunity for every
 * Account that already exists without one, so post-deploy the two
 * totals reconcile on day one.
 */
export async function syncAccountDeal(
  accountId: string,
  accountName: string,
  ownerId: string,
  permissions: string[],
  deal: DealInput | undefined,
): Promise<void> {
  const stage = (deal?.stage ?? "qualified") as OpportunityStage;
  const existing = deal?.opportunityId
    ? await opportunityRepository.findById(deal.opportunityId)
    : await opportunityRepository.findLatestByAccountId(accountId);

  if (existing && existing.accountId !== accountId) return;

  const launch = launchDateValue(deal?.launchDate);
  const revenueLaunch = launchDateValue(deal?.revenueLaunchDate);

  if (existing) {
    // Update path — only touch fields the form actually sent. With no
    // deal payload at all this is a no-op (the empty spread leaves
    // the existing opportunity untouched).
    if (!deal) return;
    await opportunityService.update(existing.id, ownerId, permissions, {
      ...(deal.stage !== undefined && { stage: deal.stage }),
      ...(deal.probability !== undefined && { probability: deal.probability }),
      ...(deal.value !== undefined && { value: deal.value }),
      ...(deal.currency !== undefined && { currency: deal.currency }),
      ...(launch !== undefined && {
        launchDate: launch === "" ? "" : launch,
      }),
      ...(revenueLaunch !== undefined && {
        revenueLaunchDate: revenueLaunch === "" ? "" : revenueLaunch,
      }),
      ...(deal.stage !== undefined &&
        deal.probability === undefined &&
        !existing.probabilityCustom && {
          probability: STAGE_PROBABILITY_DEFAULTS[stage],
        }),
    });
    return;
  }

  // Create path — even with no deal data we spawn a stub so the
  // Account is visible in the Pipeline kanban from day one.
  const probability = deal?.probability ?? STAGE_PROBABILITY_DEFAULTS[stage];

  await opportunityService.create(ownerId, permissions, {
    name: accountName,
    accountId,
    stage,
    value: deal?.value ?? 0,
    currency: deal?.currency ?? "USD",
    probability,
    launchDate: launch && launch !== "" ? launch : undefined,
    revenueLaunchDate:
      revenueLaunch && revenueLaunch !== "" ? revenueLaunch : undefined,
  });
}
