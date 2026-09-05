"use client";

import { Badge } from "@/components/shared/badge";
import {
  labelForBusinessUnitCode,
  useBusinessUnits,
  variantForBusinessUnitCode,
} from "@/hooks/use-business-units";
import { OPPORTUNITY_STAGE_LABELS } from "@/services/crm-opportunity.service";

/** One unit and the stage that unit is at. Mirrors the API's `units`. */
export interface BusinessUnitStage {
  businessUnit: string;
  stage: string;
}

interface BusinessUnitStageChipsProps {
  units: BusinessUnitStage[] | null | undefined;
  className?: string;
}

/**
 * Human label for a stage key. Falls back to prettifying the raw key so an
 * unknown stage reads as a stage rather than as `closed_won`.
 */
function stageLabel(stage: string): string {
  const known = (OPPORTUNITY_STAGE_LABELS as Record<string, string>)[stage];
  if (known) return known;
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * The chip row on a pipeline card: one chip per business unit, each carrying
 * that unit's own stage: "Onewave - Live", "ARIA - Qualified".
 *
 * The stage belongs ON the chip because the card is one per partner and the
 * COLUMN only says where the deal is, which under the roll-up is the
 * least-advanced unit. A deal whose Onewave work is Live while ARIA is still
 * Qualified sits in Qualified; without the per-chip stage the board would
 * assert that all of it is Qualified.
 *
 * Deliberately no "+N" collapse, unlike `BusinessUnitChips`. Hiding a unit
 * hides the disagreement these chips exist to show, and a deal carries a
 * handful of units at most — so the row wraps instead. An untagged deal
 * renders the single plain "Unassigned" chip: with no unit there is no stage
 * that could differ from the column, so a suffix there would be noise.
 */
export function BusinessUnitStageChips({
  units,
  className,
}: BusinessUnitStageChipsProps) {
  // Subscribe to the cache so a freshly-loaded list re-renders the labels
  // instead of leaving raw codes on screen until the next interaction.
  useBusinessUnits();

  const hasUnits = units !== null && units !== undefined && units.length > 0;

  return (
    <div
      className={`
        flex flex-wrap items-center gap-1
        ${className ?? ""}
      `}
    >
      {hasUnits ? (
        units.map((unit) => (
          <Badge
            key={unit.businessUnit}
            variant={variantForBusinessUnitCode(unit.businessUnit)}
          >
            {labelForBusinessUnitCode(unit.businessUnit)} -{" "}
            {stageLabel(unit.stage)}
          </Badge>
        ))
      ) : (
        <Badge variant="grey">Unassigned</Badge>
      )}
    </div>
  );
}
