import { and, eq } from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { stageProbability } from "./opportunity-business-units.repository";

type DbLike = Db | DbTransaction;

export interface BusinessUnitMoveInput {
  stage?: string;
  probability?: number;
  value?: string;
  closeDate?: string | null;
  launchDate?: string | null;
  revenueLaunchDate?: string | null;
  lostReason?: string | null;
}

export async function moveBusinessUnitRow(
  db: DbLike,
  opportunityId: string,
  businessUnit: string,
  input: BusinessUnitMoveInput,
): Promise<boolean> {
  const [existing] = await db
    .select({
      businessUnit: schema.crmOpportunityBusinessUnits.businessUnit,
      stage: schema.crmOpportunityBusinessUnits.stage,
      probability: schema.crmOpportunityBusinessUnits.probability,
      probabilityCustom: schema.crmOpportunityBusinessUnits.probabilityCustom,
    })
    .from(schema.crmOpportunityBusinessUnits)
    .where(
      and(
        eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId),
        eq(schema.crmOpportunityBusinessUnits.businessUnit, businessUnit),
      ),
    )
    .limit(1);

  if (!existing) return false;

  const stageChanged = input.stage !== undefined && input.stage !== existing.stage;

  let probability: number | undefined;
  let probabilityCustom: boolean | undefined;
  if (input.probability !== undefined) {
    probability = input.probability;
    probabilityCustom = true;
  } else if (stageChanged && !existing.probabilityCustom && input.stage) {
    probability = await stageProbability(db, input.stage);
  }

  const now = new Date().toISOString();
  await db
    .update(schema.crmOpportunityBusinessUnits)
    .set({
      ...(input.stage !== undefined && { stage: input.stage }),
      ...(stageChanged && { sortOrderWithinStage: 0 }),
      ...(probability !== undefined && { probability }),
      ...(probabilityCustom !== undefined && { probabilityCustom }),
      ...(input.value !== undefined && { value: input.value }),
      ...(input.closeDate !== undefined && { closeDate: input.closeDate }),
      ...(input.launchDate !== undefined && { launchDate: input.launchDate }),
      ...(input.revenueLaunchDate !== undefined && {
        revenueLaunchDate: input.revenueLaunchDate,
      }),
      ...(input.lostReason !== undefined && { lostReason: input.lostReason }),
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId),
        eq(schema.crmOpportunityBusinessUnits.businessUnit, businessUnit),
      ),
    );

  return true;
}
