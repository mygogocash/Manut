import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import * as React from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The five states every feature owes the user, in one place.
//
// These are presentational only — they do not decide *whether* a user may see
// something. `permission-denied` is rendered when the API has already said 403;
// it never stands in for a check. Hiding UI is cosmetic, the boundary is the
// server (same rule as the sidebar's permission filtering).
//
// RELATIONSHIP TO `shared/empty-state.tsx` (Phase 5A)
//
// `EmptyState` is the canonical rendering of "there is nothing here". It has 8
// consumers, is built on the `ui/empty` primitives, and carries the app's
// established empty-state typography.
//
// `StateView` is the broader concept: loading skeletons, errors with retry,
// permission-denied and success — states `EmptyState` does not model. The two
// overlapped on exactly one case, so rather than keeping two renderings of
// "empty", `kind="empty"` now DELEGATES to `EmptyState`. One look, one place to
// change it, and the wider abstraction survives.

type StateKind =
  "loading" | "empty" | "error" | "permission-denied" | "success";

const PRESETS: Record<
  Exclude<StateKind, "loading" | "empty">,
  {
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
    title: string;
  }
> = {
  error: {
    icon: AlertTriangle,
    tone: "text-destructive",
    title: "Something went wrong",
  },
  "permission-denied": {
    icon: Lock,
    tone: "text-muted-foreground",
    title: "You do not have access to this",
  },
  success: {
    icon: CheckCircle2,
    tone: "text-emerald-600",
    title: "Done",
  },
};

export interface StateViewProps {
  kind: StateKind;
  title?: React.ReactNode;
  /** What happened and what to do about it. Errors should always say. */
  message?: React.ReactNode;
  action?: React.ReactNode;
  /**
   * A lower-emphasis second action. Kept distinct from `action` so the primary
   * one stays visually primary — an empty state with two equal buttons makes
   * the user choose before they understand the situation.
   */
  secondaryAction?: React.ReactNode;
  /** Overrides the preset icon. Pass `null` to render none. */
  icon?: React.ComponentType<{ className?: string }> | null;
  /** Retry affordance for `error`; renders a button when given. */
  onRetry?: () => void;
  /** Rows to fake while loading. Default 5. */
  skeletonRows?: number;
  /** Tighter padding, for use inside a card rather than a page. */
  compact?: boolean;
  className?: string;
}

export function StateView({
  kind,
  title,
  message,
  action,
  secondaryAction,
  icon,
  onRetry,
  skeletonRows = 5,
  compact = false,
  className,
}: StateViewProps) {
  if (kind === "loading") {
    return (
      <div
        className={cn("min-w-0 space-y-2.5", className)}
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading…</span>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton
            key={i}
            /* Varied widths so it reads as content arriving rather than a
               progress bar that has stalled. */
            className={cn("h-12 w-full rounded-md", i % 3 === 2 && "w-4/5")}
          />
        ))}
      </div>
    );
  }

  // Delegated so there is exactly one empty-state rendering in the app.
  // `action` and `secondaryAction` become `EmptyState`'s children, which is
  // where it already puts its call to action.
  if (kind === "empty") {
    return (
      <EmptyState
        title={typeof title === "string" ? title : undefined}
        description={typeof message === "string" ? message : undefined}
        icon={
          icon ? React.createElement(icon, { className: "size-8" }) : undefined
        }
        compact={compact}
        className={className}
      >
        {(action || secondaryAction) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action}
            {secondaryAction}
          </div>
        )}
      </EmptyState>
    );
  }

  const preset = PRESETS[kind];
  // `icon === null` means "no icon"; `undefined` means "use the preset".
  const Icon = icon === null ? null : (icon ?? preset.icon);

  return (
    <div
      className={cn(
        `flex min-w-0 flex-col items-center justify-center text-center`,
        compact ? "gap-2 px-4 py-8" : "gap-3 px-4 py-12 sm:py-16",
        className,
      )}
      role={kind === "error" ? "alert" : undefined}
    >
      {Icon && (
        <Icon className={cn("size-8 shrink-0", preset.tone)} aria-hidden />
      )}
      <div className="max-w-md space-y-1">
        <p className="text-foreground text-sm font-medium text-balance">
          {title ?? preset.title}
        </p>
        {message && (
          <p className="text-muted-foreground break-anywhere text-sm">
            {message}
          </p>
        )}
      </div>
      {(action || secondaryAction || (kind === "error" && onRetry)) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {kind === "error" && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
