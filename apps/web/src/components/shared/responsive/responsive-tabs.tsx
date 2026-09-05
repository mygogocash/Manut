"use client";

import * as React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// A tab strip that scrolls instead of wrapping or clipping.
//
// Three failure modes this exists to prevent, all of which the CRM tab rows hit
// today on a phone:
//
//   1. The strip stretches the page, so the whole document scrolls sideways.
//      Fixed by making the strip its own scroll container (`.allow-x-scroll`)
//      inside a `min-w-0` parent — without the min-width reset a flex/grid
//      child refuses to shrink and pushes the page wide anyway.
//   2. Tabs wrap onto three rows and eat half the screen.
//      Fixed with `shrink-0` on the triggers.
//   3. The active tab is scrolled out of sight after a route change, so the
//      user cannot see where they are. Fixed by scrolling it into view.

export interface ResponsiveTabItem {
  value: string;
  label: React.ReactNode;
  /** Rendered after the label — a count, usually. */
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface ResponsiveTabsProps {
  items: ResponsiveTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** Accessible name for the tab strip. */
  label?: string;
  children?: React.ReactNode;
}

export function ResponsiveTabs({
  items,
  value,
  onValueChange,
  className,
  label,
  children,
}: ResponsiveTabsProps) {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the selected tab visible. `nearest` so it never scrolls when the tab
  // is already on screen — re-centring on every render is disorienting.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-state="active"]`,
    );
    // Feature-checked, not just null-checked. `scrollIntoView` is missing in
    // jsdom and in some older webviews, and an effect that throws during commit
    // takes the page down over a cosmetic scroll.
    if (typeof el?.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [value]);

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn("min-w-0", className)}
    >
      <div ref={listRef} className="allow-x-scroll -mx-1 min-w-0 px-1">
        <TabsList aria-label={label} className="w-max min-w-full">
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              /* h-9 keeps the row a comfortable thumb target without making the
                 desktop strip taller than the shadcn default. */
              className="h-9 shrink-0 gap-1.5 whitespace-nowrap"
            >
              {item.label}
              {item.badge != null && (
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {item.badge}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
