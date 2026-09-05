"use client";

import { Badge } from "@/components/shared/badge";
import {
  labelForBusinessUnitCode,
  useBusinessUnits,
  variantForBusinessUnitCode,
} from "@/hooks/use-business-units";

interface BusinessUnitChipsProps {
  codes: string[] | null | undefined;
  /**
   * Chips rendered before collapsing the rest into "+N". Kanban cards are
   * narrow, so they pass 2; roomier surfaces can raise it.
   */
  max?: number;
  className?: string;
}

/**
 * The "who is taking care of this" tag row. Reads through the shared hook so
 * the label and colour follow whatever an admin last saved, and so a code
 * whose unit was deleted still renders (as its raw code) instead of
 * vanishing.
 */
export function BusinessUnitChips({
  codes,
  max = 2,
  className,
}: BusinessUnitChipsProps) {
  // Subscribe to the cache so a freshly-loaded list re-renders the labels
  // instead of leaving raw codes on screen until the next interaction.
  useBusinessUnits();

  if (!codes || codes.length === 0) return null;

  const shown = codes.slice(0, max);
  const hidden = codes.length - shown.length;

  return (
    <div
      className={`
        flex flex-wrap items-center gap-1
        ${className ?? ""}
      `}
    >
      {shown.map((code) => (
        <Badge key={code} variant={variantForBusinessUnitCode(code)}>
          {labelForBusinessUnitCode(code)}
        </Badge>
      ))}
      {hidden > 0 ? (
        // Native title so a collapsed row is still readable on hover — the
        // shared Badge takes no title prop of its own.
        <span title={codes.map(labelForBusinessUnitCode).join(", ")}>
          <Badge variant="grey">+{hidden}</Badge>
        </span>
      ) : null}
    </div>
  );
}
