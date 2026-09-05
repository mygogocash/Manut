/**
 * The per-unit stages a deal's chips display.
 *
 * The board is one card per partner (deal), so a card has to say where each
 * of its business units actually is — "Onewave - Live", "ARIA - Qualified".
 * The column says only where the DEAL is, which under the roll-up is the
 * least-advanced unit, so without this the disagreement between units is
 * invisible on the board.
 */

/** One chip: a unit and the stage that unit is at. */
export interface DealUnitStage {
  businessUnit: string;
  stage: string;
}

/** The `stage` of one child progress row. */
export interface UnitStageSource {
  businessUnit: string;
  stage: string;
}

/**
 * Resolve every tagged unit to a stage.
 *
 * Three cases have to come out identical to a reader, because all three
 * exist in live data at once:
 *
 * 1. **Seeded** — a child row exists, so its own stage wins.
 * 2. **Unseeded** — no child row yet. Falls back to the DEAL's stage, which
 *    is exactly what seeding would write (`buildSeedRows` copies the deal's
 *    stage onto every unit), so a chip never changes the moment somebody
 *    opens the deal and triggers the lazy seed.
 * 3. **Partially seeded** — some units have rows and some do not. Resolved
 *    per unit rather than per deal: `businessUnitService.delete` removes one
 *    unit's rows across every deal, so a deal with a mix is normal, not
 *    corrupt.
 *
 * Driven by `tagOrder` (`Opportunity.businessUnits`), never by the progress
 * rows, for two reasons. It is the tag list that decides which units a deal
 * HAS — a leftover row for an untagged unit must not resurrect a chip. And
 * tag order is the roll-up's tie-break order, so chips read in the same
 * order the roll-up ranks them.
 *
 * An untagged deal returns `[]`. The caller renders the plain "Unassigned"
 * chip for that: there is no unit whose stage could differ from the column,
 * so appending one would be noise.
 */
export function dealUnitStages(
  tagOrder: readonly string[],
  progress: readonly UnitStageSource[],
  dealStage: string,
): DealUnitStage[] {
  const stageByUnit = new Map(
    progress.map((row) => [row.businessUnit, row.stage]),
  );

  // Dedupe defensively: `businessUnits` is a plain text[] with no unique
  // constraint, and a duplicated code would render a duplicated chip.
  return [...new Set(tagOrder)].map((businessUnit) => ({
    businessUnit,
    stage: stageByUnit.get(businessUnit) ?? dealStage,
  }));
}
