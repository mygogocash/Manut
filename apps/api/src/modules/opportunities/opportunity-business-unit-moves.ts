import { type Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import { stageProbability } from "@/modules/opportunities/opportunity-business-units.repository";

/** A single unit's editable progress on one deal. */
export interface BusinessUnitMoveInput {
  stage?: string;
  probability?: number;
  value?: Prisma.Decimal;
  closeDate?: Date | null;
  launchDate?: Date | null;
  revenueLaunchDate?: Date | null;
  lostReason?: string | null;
}

/**
 * Move or edit ONE unit's row on a deal.
 *
 * This is what a drag on the per-unit board calls. It deliberately does NOT
 * reuse `PUT /opportunities/:id { stage }` — that writes the deal, which
 * under the roll-up means moving whichever unit is least advanced, so
 * dragging one card would move a different card.
 *
 * Returns `false` when the unit has no row on this deal. The caller decides
 * what to do: a synthesized card must be seeded first, and creating a row
 * here would bypass the seed-versus-new-tag rule that
 * `ensureBusinessUnitRows` owns.
 */
export async function moveBusinessUnitRow(
  opportunityId: string,
  businessUnit: string,
  input: BusinessUnitMoveInput,
  tx?: Prisma.TransactionClient,
): Promise<boolean> {
  const db = tx ?? prisma;

  const existing = await db.opportunityBusinessUnit.findUnique({
    where: { opportunityId_businessUnit: { opportunityId, businessUnit } },
    select: {
      businessUnit: true,
      stage: true,
      probability: true,
      probabilityCustom: true,
    },
  });
  if (!existing) return false;

  const stageChanged =
    input.stage !== undefined && input.stage !== existing.stage;

  // Same rule as the deal-level update: snap to the destination stage's
  // probability unless a human typed one. An explicit probability in the
  // payload always wins and flips the row to custom.
  let probability: number | undefined;
  let probabilityCustom: boolean | undefined;
  if (input.probability !== undefined) {
    probability = input.probability;
    probabilityCustom = true;
  } else if (stageChanged && !existing.probabilityCustom) {
    probability = await stageProbability(input.stage as string, tx);
  }

  await db.opportunityBusinessUnit.update({
    where: { opportunityId_businessUnit: { opportunityId, businessUnit } },
    data: {
      ...(input.stage !== undefined && { stage: input.stage }),
      // A card that changes column lands at the top of the destination,
      // matching the deal-level drag. An in-place edit must NOT reset it,
      // or any field change would make the card jump to the top of its own
      // column.
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
    },
  });

  return true;
}
