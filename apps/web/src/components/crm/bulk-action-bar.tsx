"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { BulkSelection } from "@/hooks/use-bulk-selection";

export interface BulkAction {
  /** Stable key for React. */
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /**
   * Destructive actions get the outline treatment rather than the primary
   * button, so "Archive" never looks like the obvious thing to click.
   */
  variant?: "default" | "outline";
}

interface BulkActionBarProps {
  selection: BulkSelection;
  /** Plural noun for the records, e.g. "deals" / "accounts" / "leads". */
  recordLabel: string;
  /**
   * Server-reported count for the current filters. Shown on the escalate
   * button, and it is why the hook takes the total rather than counting
   * loaded rows.
   */
  total: number;
  /**
   * Actions differ per record type — a lead's owner is not reassignable, for
   * instance — so the caller supplies the list rather than the bar assuming a
   * fixed set.
   */
  actions: BulkAction[];
}

/**
 * Sticky selection bar for the Sales CRM bulk actions.
 *
 * Rendered only while a selection exists, so it never takes vertical space on
 * a board somebody is just reading.
 */
export function BulkActionBar({
  selection,
  recordLabel,
  total,
  actions,
}: BulkActionBarProps) {
  if (!selection.active) return null;

  // Offer the escalation only when it would actually widen the selection —
  // otherwise "select all 3 matching" appears next to 3 ticked rows.
  const canEscalate = !selection.allMatching && total > selection.ids.length;

  return (
    <div
      className={`
        bg-background/95 sticky bottom-4 z-20 mx-auto flex w-fit max-w-full
        flex-wrap items-center gap-3 rounded-lg border px-4 py-2 shadow-lg
        backdrop-blur
      `}
      role="region"
      aria-label={`Bulk actions for selected ${recordLabel}`}
    >
      <span className="text-sm font-medium whitespace-nowrap">
        {selection.count} {recordLabel} selected
        {selection.allMatching && (
          <span className="text-muted-foreground font-normal">
            {" "}
            (all matching)
          </span>
        )}
      </span>

      {canEscalate && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-sm"
          onClick={selection.selectAllMatching}
        >
          Select all {total} matching
        </Button>
      )}

      {actions.map((action) => (
        <Button
          key={action.key}
          size="sm"
          variant={action.variant ?? "default"}
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={selection.clear}
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
