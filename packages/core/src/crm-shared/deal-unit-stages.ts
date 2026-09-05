/**
 * The per-unit stages a deal's chips display.
 */

export interface DealUnitStage {
  businessUnit: string;
  stage: string;
}

export interface UnitStageSource {
  businessUnit: string;
  stage: string;
}

export function dealUnitStages(
  tagOrder: readonly string[],
  progress: readonly UnitStageSource[],
  dealStage: string,
): DealUnitStage[] {
  const stageByUnit = new Map(progress.map((row) => [row.businessUnit, row.stage]));
  return [...new Set(tagOrder)].map((businessUnit) => ({
    businessUnit,
    stage: stageByUnit.get(businessUnit) ?? dealStage,
  }));
}
