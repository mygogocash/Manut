"use client";

import { Check, SlidersHorizontal, X } from "lucide-react";
import * as React from "react";

import { BottomSheet } from "@/components/shared/responsive/bottom-sheet";
import { ActionStrip } from "@/components/shared/responsive/responsive-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Filter UI, with no knowledge of what is being filtered.
//
// Every module builds its own filter row today, so the chips look different,
// "clear" sometimes clears and sometimes resets to a default, and on a phone
// the row wraps to three lines. These components own the presentation and the
// draft/apply mechanics; the caller owns the option lists and the query.
//
// The draft model matters on mobile: in a sheet, each tap must NOT re-run the
// query, or the list behind the sheet churns and the user cannot tell what they
// have chosen. Selections are held locally and committed on Apply.

/* ── Chip ───────────────────────────────────────────────────────────── */

export interface FilterChipProps extends Omit<
  React.ComponentProps<"button">,
  "onSelect" | "label" | "value"
> {
  /** The filter's name, e.g. "Status". */
  label: React.ReactNode;
  /** Shown after the label — the chosen value, or a count. */
  value?: React.ReactNode;
  active?: boolean;
  /** Renders an X that clears just this filter. */
  onClear?: () => void;
}

export function FilterChip({
  label,
  value,
  active = false,
  onClear,
  className,
  ...props
}: FilterChipProps) {
  return (
    <span
      className={cn(
        `
          inline-flex shrink-0 items-center gap-1 rounded-full border text-xs
          font-medium transition-colors
        `,
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-surface text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={active}
        /* h-8 keeps the chip a usable target without making the desktop row
           taller than the surrounding controls. */
        className={cn(
          "flex h-8 items-center gap-1 rounded-full px-3",
          `
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:outline-none
          `,
          onClear && active && "pr-1",
        )}
        {...props}
      >
        {label}
        {value != null && value !== "" && (
          <span className="font-semibold">{value}</span>
        )}
      </button>
      {onClear && active && (
        <button
          type="button"
          onClick={onClear}
          aria-label={
            typeof label === "string" ? `Clear ${label} filter` : "Clear filter"
          }
          className={`
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:outline-none
            hover:bg-primary/15
            mr-1 flex size-5 items-center justify-center rounded-full
          `}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/* ── Bar ────────────────────────────────────────────────────────────── */

export interface FilterBarProps extends React.ComponentProps<"div"> {
  /** Usually a `SearchInput`. Full width on mobile, inline from `sm`. */
  search?: React.ReactNode;
  /** How many filters are currently applied. Shown on the Filters button. */
  activeCount?: number;
  /** Opens the sheet. Omit to hide the button (e.g. chips are enough). */
  onOpenFilters?: () => void;
  /** Clears everything. Rendered only when something is applied. */
  onClearAll?: () => void;
}

export function FilterBar({
  search,
  activeCount = 0,
  onOpenFilters,
  onClearAll,
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div
      className={cn(
        `
          flex min-w-0 flex-col gap-2
          sm:flex-row sm:items-center
        `,
        className,
      )}
      {...props}
    >
      {search && (
        <div
          className={`
            min-w-0
            sm:max-w-xs sm:flex-1
          `}
        >
          {search}
        </div>
      )}

      {/* Chips scroll inside their own strip rather than wrapping — a wrapped
          filter row eats a third of a phone screen before any content. */}
      {children && <ActionStrip className="sm:flex-1">{children}</ActionStrip>}

      <div className="flex shrink-0 items-center gap-2">
        {onOpenFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFilters}
            className="h-8"
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span
                className={`
                  bg-primary text-primary-foreground ml-0.5 rounded-full px-1.5
                  text-[10px] font-semibold tabular-nums
                `}
              >
                {activeCount}
              </span>
            )}
          </Button>
        )}
        {onClearAll && activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground h-8"
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Group ──────────────────────────────────────────────────────────── */

export interface FilterOption {
  value: string;
  label: React.ReactNode;
  /** Matching record count, when the caller knows it. */
  count?: number;
  disabled?: boolean;
}

export interface FilterGroupProps {
  title: React.ReactNode;
  options: FilterOption[];
  /** A string for single-select, an array for multi. Drives the control's role. */
  selected: string | string[];
  onChange: (next: string | string[]) => void;
  /** Adds an "All" entry that clears this group. Single-select only. */
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}

export function FilterGroup({
  title,
  options,
  selected,
  onChange,
  includeAll = false,
  allLabel = "All",
  className,
}: FilterGroupProps) {
  const multi = Array.isArray(selected);
  const groupId = React.useId();

  const isChecked = (value: string) =>
    multi ? (selected as string[]).includes(value) : selected === value;

  const toggle = (value: string) => {
    if (!multi) {
      onChange(value);
      return;
    }
    const current = selected as string[];
    onChange(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  };

  const rows: FilterOption[] =
    includeAll && !multi
      ? [{ value: "", label: allLabel }, ...options]
      : options;

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend
        id={groupId}
        className={`
          text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide
          uppercase
        `}
      >
        {title}
      </legend>
      {/* Native radio/checkbox semantics: a screen reader then announces the
          group, the position and the state without any aria plumbing. */}
      <div role={multi ? "group" : "radiogroup"} aria-labelledby={groupId}>
        {rows.map((option) => {
          const checked = isChecked(option.value);
          return (
            <label
              key={option.value || "__all"}
              className={cn(
                `
                  hover:bg-muted/60
                  flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md
                  px-1.5 text-sm
                `,
                option.disabled && "pointer-events-none opacity-50",
              )}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={multi ? undefined : groupId}
                checked={checked}
                disabled={option.disabled}
                onChange={() => toggle(option.value)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  `
                    flex size-4 shrink-0 items-center justify-center border
                    transition-colors
                  `,
                  multi ? "rounded-[4px]" : "rounded-full",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {checked &&
                  (multi ? (
                    <Check className="size-3" />
                  ) : (
                    <span
                      className={`bg-primary-foreground size-1.5 rounded-full`}
                    />
                  ))}
              </span>
              <span className="break-anywhere min-w-0 flex-1">
                {option.label}
              </span>
              {option.count != null && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {option.count}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ── Sheet ──────────────────────────────────────────────────────────── */

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The groups. Render `FilterGroup`s bound to the draft state. */
  children: React.ReactNode;
  onApply: () => void;
  onReset: () => void;
  /** Disables Apply when the draft matches what is already applied. */
  applyDisabled?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  applyLabel?: string;
  resetLabel?: string;
}

export function FilterSheet({
  open,
  onOpenChange,
  children,
  onApply,
  onReset,
  applyDisabled = false,
  title = "Filters",
  description = "Narrow the list, then apply.",
  applyLabel = "Apply",
  resetLabel = "Reset",
}: FilterSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onReset}
            className={`
              flex-1
              sm:flex-none
            `}
          >
            {resetLabel}
          </Button>
          <Button
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
            disabled={applyDisabled}
            className="flex-1"
          >
            {applyLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2">{children}</div>
    </BottomSheet>
  );
}

/**
 * Draft state for a filter sheet.
 *
 * Holds an editable copy, tells you whether it differs from what is applied,
 * and resyncs whenever the sheet reopens — so abandoning a sheet discards the
 * draft instead of leaking it into the next open.
 */
export function useFilterDraft<T>(applied: T, open: boolean) {
  const [draft, setDraft] = React.useState<T>(applied);

  React.useEffect(() => {
    if (open) setDraft(applied);
  }, [open, applied]);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(applied),
    [draft, applied],
  );

  return { draft, setDraft, dirty };
}
