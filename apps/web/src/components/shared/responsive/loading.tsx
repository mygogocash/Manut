"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Loading affordances that keep the layout still.
//
// The rule: a skeleton where the shape of the content is known, a spinner only
// where it is not. A spinner in place of a list tells the user nothing and
// causes a full reflow when the data lands; a skeleton of the right shape means
// nothing moves.
//
// `ui/skeleton.tsx` and `ui/spinner.tsx` already exist — these are the
// *compositions* that were being rebuilt per screen.

/**
 * A button that shows progress without changing size.
 *
 * `ui/button.tsx` has 8 variants and 8 sizes but no loading state, so callers
 * either swapped the label for a spinner (the button resized and the row
 * jumped) or left the button live during the request (double submits). This
 * keeps the label, disables the button, and marks it `aria-busy`.
 */
export interface LoadingButtonProps extends React.ComponentProps<
  typeof Button
> {
  loading?: boolean;
  /** Replaces the label while loading. Keep it short; the width is the label's. */
  loadingLabel?: React.ReactNode;
}

export function LoadingButton({
  loading = false,
  loadingLabel,
  disabled,
  children,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn("relative", className)}
      {...props}
    >
      {loading && <Spinner className="size-3.5" aria-hidden />}
      {loading && loadingLabel ? loadingLabel : children}
    </Button>
  );
}

/** Placeholder for a `DataCard`-shaped panel. */
export function CardSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        `
          border-border bg-surface min-w-0 rounded-lg border p-3
          sm:p-4
        `,
        className,
      )}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-3.5 w-full", i === lines - 1 && "w-3/5")}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Placeholder for a list of records. Matches `RecordCard`'s height, so the
 * list does not jump when real rows replace it.
 */
export function ListSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("min-w-0 space-y-2.5", className)}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading list…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-border bg-surface rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a whole page: a header, a KPI row, then a list. */
export function PageSkeleton({
  kpis = 4,
  rows = 4,
  className,
}: {
  kpis?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("min-w-0 space-y-5", className)}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading page…</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      {kpis > 0 && (
        <div
          className={`
            grid grid-cols-2 gap-3
            lg:grid-cols-4
          `}
        >
          {Array.from({ length: kpis }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      )}
      <ListSkeleton rows={rows} />
    </div>
  );
}

/**
 * A centred spinner, for the genuinely unknown-shape case — an inline action
 * result, a chart whose dimensions come from the data.
 */
export function InlineLoader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-center gap-2 py-8", className)}
      role="status"
      aria-live="polite"
    >
      <Spinner className="text-muted-foreground size-4" aria-hidden />
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
