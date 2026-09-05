import * as React from "react";

import { cn } from "@/lib/utils";

// Responsive grids as named intents rather than ad-hoc column counts.
//
// The brief's warning — "do not blindly force 2-column layouts" — is the whole
// reason this is a small set of *content-typed* presets instead of a generic
// `cols` prop. A KPI tile survives being half a phone wide; a chart or a form
// row does not. Naming the content type makes the right choice the easy one.
//
// Class strings are full literals so Tailwind's static scan can see them; a
// computed `grid-cols-${n}` would be purged and silently render one column
// (see the Tailwind pitfall in CLAUDE.md).

const VARIANTS = {
  /**
   * Compact metric tiles. Two across on a phone is correct here — a KPI is a
   * label and a number, and one-per-row wastes a screen.
   */
  kpi: "grid-cols-2 lg:grid-cols-4",
  /** Same, for six metrics. */
  kpi6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  /**
   * Cards with prose, avatars or several lines of detail. Single column on a
   * phone — two would truncate everything that matters.
   */
  cards: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  /** Wider content cards: charts, tables-in-cards, activity feeds. */
  panels: "grid-cols-1 lg:grid-cols-2",
  /**
   * Charts. Never two-up below `lg` — axis labels become unreadable long
   * before the container gets narrow enough to look broken.
   */
  charts: "grid-cols-1 lg:grid-cols-2",
  /** A main column with a sidebar that drops underneath on smaller screens. */
  split: "grid-cols-1 lg:grid-cols-3",
  /** Form fields: stacked on mobile, paired from `sm` up. */
  fields: "grid-cols-1 sm:grid-cols-2",
} as const;

const GAPS = {
  sm: "gap-2 sm:gap-3",
  md: "gap-3 sm:gap-4",
  lg: "gap-4 sm:gap-6",
} as const;

export interface ResponsiveGridProps extends React.ComponentProps<"div"> {
  /** What the cells contain. Drives the column counts. Default `cards`. */
  variant?: keyof typeof VARIANTS;
  gap?: keyof typeof GAPS;
}

export function ResponsiveGrid({
  variant = "cards",
  gap = "md",
  className,
  ...props
}: ResponsiveGridProps) {
  return (
    <div
      className={cn("grid min-w-0", VARIANTS[variant], GAPS[gap], className)}
      {...props}
    />
  );
}

/**
 * A cell that spans the wide column of a `split` grid. Kept here so callers do
 * not hand-write `lg:col-span-2` and drift.
 */
export function ResponsiveGridMain({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        `
          min-w-0
          lg:col-span-2
        `,
        className,
      )}
      {...props}
    />
  );
}
