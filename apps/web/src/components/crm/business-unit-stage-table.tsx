"use client";

import { Plus, X } from "lucide-react";

import { BusinessUnitChips } from "@/components/crm/business-unit-chips";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** One editable row: a unit and the stage IT is at. */
export interface UnitStageRow {
  businessUnit: string;
  stage: string;
}

interface BusinessUnitStageTableProps {
  /** Every selectable unit, from the shared business-unit catalog. */
  options: { code: string; label: string }[];
  rows: UnitStageRow[];
  onChange: (rows: UnitStageRow[]) => void;
  stages: readonly string[];
  stageLabel: (stage: string) => string;
  stageProbability: (stage: string) => number;
  /**
   * The stage a newly added unit starts at — the first in the catalog order.
   * A new unit has NOT done the work its siblings have, so it must not inherit
   * a sibling's stage; the server applies the same rule, and disagreeing here
   * would show the rep a stage the save then changes under them.
   */
  firstStage: string;
  disabled?: boolean;
}

/**
 * Stage-per-business-unit editor.
 *
 * A deal's units move at their own pace — Onewave can be Qualified while ARIA
 * is Live — which a single deal-level Stage field cannot express. Shared by
 * both CRM forks (like BusinessUnitChips) so the two dialogs cannot drift on
 * the rules encoded here.
 *
 * Renders nothing when there are no rows: an untagged deal keeps the plain
 * deal-level Stage field, so nothing regresses for deals that have no units.
 */
export function BusinessUnitStageTable({
  options,
  rows,
  onChange,
  stages,
  stageLabel,
  stageProbability,
  firstStage,
  disabled,
}: BusinessUnitStageTableProps) {
  const used = new Set(rows.map((r) => r.businessUnit));
  const available = options.filter((o) => !used.has(o.code));

  function setStage(businessUnit: string, stage: string) {
    onChange(
      rows.map((r) => (r.businessUnit === businessUnit ? { ...r, stage } : r)),
    );
  }

  function remove(businessUnit: string) {
    onChange(rows.filter((r) => r.businessUnit !== businessUnit));
  }

  function add(businessUnit: string) {
    onChange([...rows, { businessUnit, stage: firstStage }]);
  }

  return (
    <div
      className={`
        border-border bg-background/40 overflow-hidden rounded-md border
      `}
    >
      <div
        className={`
          border-border flex items-baseline justify-between gap-3 border-b px-3
          py-2.5
        `}
      >
        <div className="flex flex-col gap-0.5">
          <p className="text-foreground text-sm font-medium">
            Business units &amp; stage
          </p>
          <p className="text-muted-foreground text-xs">
            Each unit moves at its own pace. Set the stage per unit.
          </p>
        </div>
        {rows.length > 0 ? (
          <div
            className={`
              text-muted-foreground hidden gap-8 pr-7
              sm:flex
            `}
          >
            <span
              className={`
                w-[168px] text-[11px] font-medium tracking-wide uppercase
              `}
            >
              Stage
            </span>
            <span
              className={`w-14 text-[11px] font-medium tracking-wide uppercase`}
            >
              Prob.
            </span>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-xs">
          No business units yet — this deal shows under &ldquo;Unassigned&rdquo;
          and keeps a single stage.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((row) => (
            <li
              key={row.businessUnit}
              className={`
                flex items-center gap-3 px-3 py-2
                sm:gap-8
              `}
            >
              <div className="min-w-0 flex-1">
                <BusinessUnitChips codes={[row.businessUnit]} max={1} />
              </div>
              <div className="w-[168px] shrink-0">
                <Select
                  value={row.stage}
                  onValueChange={(next) => setStage(row.businessUnit, next)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s} value={s}>
                        {stageLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/*
                Probability follows the unit's stage, exactly as it does for a
                deal-level stage move. Shown rather than editable so this
                dialog cannot introduce a second way to set it.
              */}
              <span
                className={`
                  text-muted-foreground hidden w-14 shrink-0 text-sm
                  tabular-nums
                  sm:inline
                `}
              >
                {stageProbability(row.stage)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Remove ${row.businessUnit}`}
                disabled={disabled}
                onClick={() => remove(row.businessUnit)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <div className="border-border border-t px-3 py-2.5">
          <Select value="" onValueChange={add} disabled={disabled}>
            <SelectTrigger
              className={`
                text-muted-foreground h-8 w-auto gap-2 border-dashed text-xs
              `}
            >
              <Plus className="size-3.5" />
              <SelectValue placeholder="Add business unit" />
            </SelectTrigger>
            <SelectContent>
              {available.map((o) => (
                <SelectItem key={o.code} value={o.code}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The stage a set of unit rows rolls up to: the LEAST advanced, by catalog
 * sort order. Ties resolve to the first row, which matches the server using
 * the tag array's order.
 *
 * Mirrors `computeOpportunityRollup` so the read-only deal stage this dialog
 * shows is the one the server will store. Returns null for no rows — the
 * caller then keeps the deal's own stage.
 */
export function rollUpStage(
  rows: UnitStageRow[],
  sortOrder: (stage: string) => number,
): string | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) =>
    sortOrder(row.stage) < sortOrder(best.stage) ? row : best,
  ).stage;
}
