import type { CreateAccountInput } from "@nexora/contracts/modules/accounts/accounts.validation";
import {
  STAGE_PROBABILITY_DEFAULTS,
  type OpportunityStage,
} from "@nexora/contracts/modules/opportunities/opportunities.constants";
import type { Db } from "@nexora/db";
import * as oppRepo from "../opportunities/opportunities.repository";

type DealInput = NonNullable<CreateAccountInput["deal"]>;

function launchDateValue(raw: string | null | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (raw === "" || raw === null) return "";
  return raw;
}

export async function syncAccountDeal(
  db: Db,
  accountId: string,
  accountName: string,
  ownerId: string,
  deal: DealInput | undefined,
): Promise<void> {
  const stage = (deal?.stage ?? "qualified") as OpportunityStage;
  const existing = deal?.opportunityId
    ? await oppRepo.findById(db, deal.opportunityId)
    : await oppRepo.findLatestByAccountId(db, accountId);

  if (existing && existing.accountId !== accountId) return;

  const launch = launchDateValue(deal?.launchDate);
  const revenueLaunch = launchDateValue(deal?.revenueLaunchDate);

  if (existing) {
    if (!deal) return;
    const patch: Parameters<typeof oppRepo.update>[2] = {};
    if (deal.stage !== undefined) patch.stage = deal.stage;
    if (deal.probability !== undefined) {
      patch.probability = deal.probability;
      patch.probabilityCustom = true;
    }
    if (deal.value !== undefined) patch.value = String(deal.value);
    if (deal.currency !== undefined) patch.currency = deal.currency;
    if (launch !== undefined) patch.launchDate = launch === "" ? null : launch;
    if (revenueLaunch !== undefined) {
      patch.revenueLaunchDate = revenueLaunch === "" ? null : revenueLaunch;
    }
    if (
      deal.stage !== undefined &&
      deal.probability === undefined &&
      !existing.probabilityCustom
    ) {
      patch.probability = STAGE_PROBABILITY_DEFAULTS[stage];
    }
    if (Object.keys(patch).length > 0) {
      await oppRepo.update(db, existing.id, patch);
    }
    return;
  }

  const probability = deal?.probability ?? STAGE_PROBABILITY_DEFAULTS[stage];
  await oppRepo.create(db, {
    name: accountName,
    accountId,
    ownerId,
    stage,
    value: String(deal?.value ?? 0),
    currency: deal?.currency ?? "USD",
    probability,
    probabilityCustom: deal?.probability !== undefined,
    launchDate: launch && launch !== "" ? launch : null,
    revenueLaunchDate: revenueLaunch && revenueLaunch !== "" ? revenueLaunch : null,
  });
}
