"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsBelow } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

// A dialog on desktop, a bottom sheet on mobile.
//
// Deliberately a NEW wrapper rather than a change to `ui/dialog.tsx`. That
// primitive has 198 call sites; making it shape-shift by width would change all
// of them at once, and some of those dialogs (confirmations, small pickers) are
// perfectly usable as centred dialogs on a phone. The brief says not to convert
// every modal automatically — so conversion is opt-in, one caller at a time.
//
// `vaul` (already a dependency, previously unused) provides the sheet: it has
// the drag-to-dismiss, scroll-locking and focus behaviour people expect from a
// native sheet, which a repositioned dialog does not.

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Strongly recommended: the sheet and dialog both announce it. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Applied to the dialog content on desktop only. */
  className?: string;
  /**
   * `sheet` (default) becomes a bottom sheet below 768px.
   * `dialog` stays a centred dialog at every width — right for short
   * confirmations, where a full-width sheet is more disruptive than the
   * decision warrants.
   */
  mobileMode?: "sheet" | "dialog";
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  mobileMode = "sheet",
}: ResponsiveDialogProps) {
  const isCompact = useIsBelow("md");

  if (isCompact && mobileMode === "sheet") {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {/* Capped so the sheet never covers the whole screen — leaving the page
            visible above it is what makes it read as "over" rather than "away
            from" where the user was. */}
        <DrawerContent className="max-h-[92svh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description && (
              <DrawerDescription>{description}</DrawerDescription>
            )}
          </DrawerHeader>
          {/* The body scrolls, not the sheet, so the header and footer stay put
              with the keyboard open. */}
          <div className="min-w-0 flex-1 overflow-y-auto px-4 pb-2">
            {children}
          </div>
          {footer && (
            <DrawerFooter className="pb-safe-offset-4 gap-2 border-t pt-3">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          `
            max-h-[90vh] overflow-y-auto
            sm:max-w-lg
          `,
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
