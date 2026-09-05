"use client";

import * as React from "react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

// A bottom sheet, on any screen size.
//
// Separate from `ResponsiveDialog` (which picks dialog-or-sheet by width) for
// the cases where a sheet is the right presentation regardless: a filter panel,
// a picker, an action list. Forcing those through the responsive wrapper would
// make them centred dialogs on desktop, which is the wrong shape for a panel
// you scan and dismiss.
//
// Built on vaul via `ui/drawer.tsx`, so focus trapping, body-scroll locking,
// Escape and drag-to-dismiss come from a library that handles them properly —
// hand-rolled sheets get the scroll lock wrong on iOS almost every time.

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: it is the sheet's accessible name. */
  title: React.ReactNode;
  /** Announced with the title. Strongly recommended for anything non-obvious. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Pinned below the body, clear of the home indicator. */
  footer?: React.ReactNode;
  /** Cap on height. Default `max-h-[85svh]`, a literal so Tailwind sees it. */
  maxHeightClass?: string;
  /** Hides the visible header. The accessible name is still announced. */
  hideHeader?: boolean;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxHeightClass = "max-h-[85svh]",
  hideHeader = false,
  className,
}: BottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* `svh` not `vh`: on mobile Safari `vh` includes the retracted URL bar,
          so a 90vh sheet is taller than the visible viewport and its footer
          sits below the fold. */}
      <DrawerContent className={cn(maxHeightClass, "min-w-0", className)}>
        <DrawerHeader className={cn("text-left", hideHeader && "sr-only")}>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : /* Radix warns when a dialog has no description; an empty one is
               worse for a screen reader than none, so only render when given. */
          null}
        </DrawerHeader>

        {/* The body scrolls, not the sheet — so the title stays put and the
            footer stays reachable with a keyboard open. */}
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {children}
        </div>

        {footer && (
          <DrawerFooter className="border-border pb-safe-offset-4 border-t pt-3">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export { DrawerClose as BottomSheetClose };
