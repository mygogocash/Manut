"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useIsBelow } from "@/hooks/use-breakpoint";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const mobile = useIsBelow("md");

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      /* Top-centre on mobile, bottom-right on desktop.
         Bottom placement on a phone lands on top of the sticky form action bar
         and the browser chrome, so a success toast covers the Save button the
         user just pressed. Sonner reads this once on mount; a rotation keeps
         the initial choice, which is acceptable — the alternative is
         remounting the toaster and dropping any visible toast. */
      position={mobile ? "top-center" : "bottom-right"}
      /* Above the overlay layer, so a toast raised from inside a dialog or
         bottom sheet is not painted behind it. See --z-toast in globals.css. */
      style={{ zIndex: "var(--z-toast)" } as React.CSSProperties}
      /* Sonner's default is 3 lanes; on a narrow screen a stack of three
         covers the header. */
      visibleToasts={mobile ? 2 : 3}
      /* Swipe-to-dismiss is the expected gesture on a phone and the only
         manual dismissal when there is no close button. */
      closeButton={!mobile}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
