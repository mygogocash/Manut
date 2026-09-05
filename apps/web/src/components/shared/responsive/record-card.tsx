"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The mobile representation of a table row.
//
// A row has one thing you identify it by, two or three you scan, and a tail of
// detail you only want once you have picked the row. A table shows all of it at
// once because it has the width to; a phone does not, so the card shows the
// first two tiers and puts the tail behind a tap.
//
// Expansion is in-place rather than a navigation, because the point is to
// answer "is this the record I want?" without losing your place in the list.
//
// Phase 2 added the `row` expand mode, the loading and disabled states, and
// keyboard support. `button` remains the default so `DataTable`'s ~75 tables
// keep the behaviour they shipped with in Phase 1.

export interface RecordCardField {
  label: string;
  value: React.ReactNode;
}

export interface RecordCardProps {
  /** What identifies the record. Rendered as the card's heading. */
  title: React.ReactNode;
  /** One line of supporting context under the title. */
  subtitle?: React.ReactNode;
  /** Status pill or similar, shown top-right. */
  badge?: React.ReactNode;
  /** Always-visible fields — keep to three or fewer. */
  fields?: RecordCardField[];
  /** Revealed on tap. Absent means the card does not expand. */
  details?: RecordCardField[];
  /** Action row, pinned to the bottom of the card. Shown only when expanded in `row` mode. */
  actions?: React.ReactNode;
  /** Whole-card tap target. Ignored in `row` expand mode, where the row toggles. */
  onClick?: () => void;
  selected?: boolean;
  /** Rendered before the title — a checkbox, usually. */
  leading?: React.ReactNode;
  /**
   * `button` — a "Show more" control under the fields. The card itself may be
   *   a separate tap target (navigation), which is how `DataTable` uses it.
   * `row`  — the header row *is* the toggle, with a chevron. Right when the
   *   record expands rather than navigates. The two are mutually exclusive by
   *   design: a card-wide target with a nested toggle gives two overlapping
   *   hit areas, and on a phone the wrong one fires about half the time.
   */
  expandMode?: "button" | "row";
  /** Controlled expansion. Omit for internal state. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Replaces the body with skeletons, keeping the card's height. */
  loading?: boolean;
  /**
   * Dims and blocks interaction — for a record the user may see but not act on.
   * Presentation only: it is never the permission boundary, which is the API.
   */
  disabled?: boolean;
  /** Shown in place of the details when expansion failed to load. */
  error?: React.ReactNode;
  className?: string;
}

function FieldList({
  fields,
  className,
}: {
  fields: RecordCardField[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-3 gap-y-2", className)}>
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt
            className={`
              text-muted-foreground text-[10px] font-medium tracking-wide
              uppercase
            `}
          >
            {field.label}
          </dt>
          <dd className="break-anywhere text-foreground mt-0.5 text-sm">
            {field.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordCard({
  title,
  subtitle,
  badge,
  fields,
  details,
  actions,
  onClick,
  selected,
  leading,
  expandMode = "button",
  expanded: expandedProp,
  onExpandedChange,
  loading = false,
  disabled = false,
  error,
  className,
}: RecordCardProps) {
  const [internalExpanded, setInternalExpanded] = React.useState(false);
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  const canExpand =
    !loading && (Boolean(details && details.length > 0) || Boolean(error));
  const rowToggles = expandMode === "row" && canExpand;
  // In `row` mode the row owns the gesture, so a card-wide click would compete.
  const clickable = Boolean(onClick) && !rowToggles && !disabled;
  const contentId = React.useId();

  const heading = (
    <>
      {/* `data-slot` so the card's heading can be asserted directly. Phase 8C
          needed to prove *which* column becomes the title, and matching on the
          typography classes to find it is the kind of test that breaks on a
          restyle. Attribute only -- no role, no visual change. */}
      <span
        data-slot="record-card-title"
        className={cn(
          "break-anywhere block text-sm font-medium",
          disabled ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {title}
      </span>
      {subtitle && (
        <span
          className={`break-anywhere text-muted-foreground mt-0.5 block text-xs`}
        >
          {subtitle}
        </span>
      )}
    </>
  );

  return (
    <div
      data-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      className={cn(
        "border-border bg-surface min-w-0 rounded-lg border p-3 shadow-sm",
        selected && "ring-primary/40 border-primary/40 ring-1",
        (clickable || rowToggles) && "transition-colors",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {leading && <div className="shrink-0 pt-0.5">{leading}</div>}

        <div className="min-w-0 flex-1">
          {rowToggles ? (
            /* A real <button>, so Enter, Space and focus come from the platform
               rather than from hand-written key handlers. */
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls={contentId}
              disabled={disabled}
              className={`
                focus-visible:ring-ring focus-visible:rounded-sm
                focus-visible:ring-2 focus-visible:outline-none
                flex w-full min-w-0 items-start gap-2 text-left
              `}
            >
              <span className="min-w-0 flex-1">{heading}</span>
              <ChevronRight
                aria-hidden
                className={cn(
                  `
                    text-muted-foreground mt-0.5 size-4 shrink-0
                    transition-transform
                  `,
                  expanded && "rotate-90",
                )}
              />
            </button>
          ) : clickable ? (
            <button
              type="button"
              onClick={onClick}
              className={`
                focus-visible:ring-ring focus-visible:rounded-sm
                focus-visible:ring-2 focus-visible:outline-none
                block w-full min-w-0 text-left
              `}
            >
              {heading}
            </button>
          ) : (
            <div className="min-w-0">{heading}</div>
          )}
        </div>

        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {loading ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
        </div>
      ) : (
        fields &&
        fields.length > 0 &&
        /* In `row` mode the fields are part of the detail, so the collapsed
           card stays two lines and a long list is scannable. */
        (expandMode === "button" || expanded) && (
          <FieldList fields={fields} className="mt-3" />
        )
      )}

      {canExpand && expandMode === "button" && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={contentId}
          disabled={disabled}
          className={`
            text-muted-foreground mt-3 flex h-9 w-full items-center
            justify-center gap-1 rounded-md text-xs font-medium
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:outline-none
            hover:text-foreground
          `}
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      )}

      {canExpand && expanded && (
        <div id={contentId} className="border-border mt-2 border-t pt-3">
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : (
            <FieldList fields={details ?? []} />
          )}
        </div>
      )}

      {/* Ungated, deliberately. The fields above ARE gated in `row` mode —
          there they are the record's detail, and hiding them is what keeps a
          collapsed row to two lines. Actions are not detail: an action bar is
          what a person came to the card to use, and on a record awaiting a
          decision it is the primary control. Gating both on the same condition
          read like symmetry and was actually the Phase 7A defect — a buried
          Approve — reintroduced through the other expand mode. */}
      {actions && (
        /* Touch targets are enforced HERE rather than at each call site.
           A card is a touch presentation by construction, and the controls that
           land in this bar were written for a desktop table row — leave's
           Approve / Reject are `size="xs"`, which is 24px. Raising them once
           here covers every table that adopts the `actions` role, instead of
           asking 49 call sites to remember. 44px on both axes is WCAG 2.5.5 /
           Apple HIG; `min-*` so a control that is already larger is untouched,
           and the desktop TABLE never renders this element at all. */
        <div
          className={`
            border-border mt-3 flex items-center justify-end gap-2 border-t pt-3
            [&_a]:min-h-11 [&_button]:min-h-11 [&_button]:min-w-11
          `}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
