"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The generic content card.
//
// Composes `ui/card.tsx` rather than replacing it — that primitive already has
// the surface, border and radius the design language uses, and 60-odd files
// depend on it. What it does not have is a *shape*: every caller hand-assembles
// a header with a title, a status, an action row and sometimes a footer, so the
// spacing and hierarchy drift card to card.
//
// Distinct from `RecordCard`, deliberately: this is a panel that happens to
// hold content (a chart, a summary, a form section), whereas `RecordCard` is a
// table row rendered for a phone. Merging them would give one component two
// jobs and a confusing prop surface.

export interface DataCardProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small dimmed line above the title — a category or timestamp. */
  meta?: React.ReactNode;
  /** Top-right of the header. A `StatusBadge`, usually. */
  status?: React.ReactNode;
  /** Header actions. Prefer `ResponsiveActions` so they demote on mobile. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Replaces the body with skeletons, keeping the card's shape. */
  loading?: boolean;
  /** Dims and blocks interaction. Not a permission boundary — see StateView. */
  disabled?: boolean;
  /** Collapsible body. `defaultExpanded` sets the initial state. */
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** Tighter padding for dense grids. */
  compact?: boolean;
}

export function DataCard({
  title,
  subtitle,
  meta,
  status,
  actions,
  footer,
  loading = false,
  disabled = false,
  collapsible = false,
  defaultExpanded = true,
  compact = false,
  className,
  children,
  ...props
}: DataCardProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const bodyId = React.useId();
  const hasHeader = Boolean(title || subtitle || meta || status || actions);
  const showBody = !collapsible || expanded;

  return (
    <Card
      data-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      className={cn(
        "min-w-0 gap-0 overflow-hidden py-0",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            `border-border flex items-start justify-between gap-2 border-b`,
            compact ? "px-3 py-2.5" : "px-3 py-3 sm:px-4",
          )}
        >
          <div className="min-w-0 flex-1">
            {meta && (
              <p
                className={`
                  text-muted-foreground text-[10px] font-medium tracking-wide
                  uppercase
                `}
              >
                {meta}
              </p>
            )}
            {title && (
              <h3
                className={`
                  text-foreground min-w-0 text-sm font-semibold text-balance
                `}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-muted-foreground break-anywhere mt-0.5 text-xs">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {status}
            {actions}
            {collapsible && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls={bodyId}
                aria-label={expanded ? "Collapse section" : "Expand section"}
                className={`
                  text-muted-foreground flex size-8 items-center justify-center
                  rounded-md
                  focus-visible:ring-ring focus-visible:ring-2
                  focus-visible:outline-none
                  hover:text-foreground
                `}
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>
            )}
          </div>
        </div>
      )}

      {showBody && (
        <CardContent
          id={bodyId}
          className={cn("min-w-0", compact ? "p-3" : "p-3 sm:p-4")}
        >
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            children
          )}
        </CardContent>
      )}

      {footer && !loading && showBody && (
        <CardFooter
          className={cn(
            "border-border block border-t",
            compact ? "px-3 py-2.5" : "px-3 py-3 sm:px-4",
          )}
        >
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
