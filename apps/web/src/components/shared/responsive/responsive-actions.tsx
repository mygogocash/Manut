"use client";

import { MoreHorizontal } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsBelow } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

// Action sets that shed gracefully instead of wrapping.
//
// The rule is *demote, never remove* — every action stays reachable at every
// width, it just moves into the overflow menu. A row of six buttons on a phone
// wraps onto three lines and puts a destructive action directly under where a
// primary one was a moment ago, which is how people click the wrong thing.
//
// Ordering is stable and derived from `variant`, not from array order, so the
// same action sits in the same place on every record.

export interface ResponsiveAction {
  id: string;
  label: string;
  onSelect: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * `primary` — the expected next step; stays a button as long as possible.
   * `secondary` — useful, demoted to the menu on narrow screens.
   * `destructive` — always last, and never promoted to a bare button on
   *   mobile, so it is never where a primary action just was.
   */
  variant?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  /** Hidden entirely — use for permission-gated actions. */
  hidden?: boolean;
}

const WEIGHT: Record<NonNullable<ResponsiveAction["variant"]>, number> = {
  primary: 0,
  secondary: 1,
  destructive: 2,
};

export interface ActionSplit {
  visible: ResponsiveAction[];
  overflow: ResponsiveAction[];
}

/**
 * Splits actions into buttons and menu items.
 *
 * Pure, and exported so the rules can be tested without a DOM. `maxVisible` of
 * 0 puts everything in the menu.
 */
export function splitActions(
  actions: ResponsiveAction[],
  maxVisible: number,
): ActionSplit {
  const usable = actions
    .filter((a) => !a.hidden)
    .slice()
    .sort(
      (a, b) =>
        WEIGHT[a.variant ?? "secondary"] - WEIGHT[b.variant ?? "secondary"],
    );

  const promotable = usable.filter((a) => a.variant !== "destructive");
  const visible = promotable.slice(0, Math.max(0, maxVisible));
  const visibleIds = new Set(visible.map((a) => a.id));

  return {
    visible,
    overflow: usable.filter((a) => !visibleIds.has(a.id)),
  };
}

export interface ResponsiveActionsProps {
  actions: ResponsiveAction[];
  /** Buttons shown before overflow kicks in. Default 1 on mobile, 3 above. */
  maxVisibleMobile?: number;
  maxVisibleDesktop?: number;
  size?: "sm" | "default";
  className?: string;
  /** Accessible name for the overflow trigger. */
  overflowLabel?: string;
}

export function ResponsiveActions({
  actions,
  maxVisibleMobile = 1,
  maxVisibleDesktop = 3,
  size = "sm",
  className,
  overflowLabel = "More actions",
}: ResponsiveActionsProps) {
  const isCompact = useIsBelow("md");
  const { visible, overflow } = splitActions(
    actions,
    isCompact ? maxVisibleMobile : maxVisibleDesktop,
  );

  if (visible.length === 0 && overflow.length === 0) return null;

  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            size={size}
            variant={action.variant === "primary" ? "default" : "outline"}
            disabled={action.disabled}
            onClick={action.onSelect}
          >
            {Icon && <Icon className="size-3.5" />}
            {action.label}
          </Button>
        );
      })}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              /* 36px on mobile: a 28px icon button is below the 44px guidance
                 and this one opens everything that got demoted. */
              className={`
                size-9
                md:size-8
              `}
              aria-label={overflowLabel}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {overflow.map((action, i) => {
              const Icon = action.icon;
              const prev = overflow[i - 1];
              const needsRule =
                action.variant === "destructive" &&
                prev &&
                prev.variant !== "destructive";
              return (
                <React.Fragment key={action.id}>
                  {needsRule && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={action.disabled}
                    onSelect={action.onSelect}
                    variant={
                      action.variant === "destructive"
                        ? "destructive"
                        : "default"
                    }
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * A horizontally scrollable strip for filter chips and segmented controls —
 * things that genuinely are a row and should scroll rather than collapse into a
 * menu. Scrolls inside itself, so the page never does.
 */
export function ActionStrip({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "allow-x-scroll -mx-1 flex min-w-0 items-center gap-2 px-1 py-0.5",
        className,
      )}
      {...props}
    />
  );
}
