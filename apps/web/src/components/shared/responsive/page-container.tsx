import * as React from "react";

import { cn } from "@/lib/utils";

// The standard page wrapper.
//
// The shell used to hardcode `px-6 py-5` on the scroll region, which is 24px of
// horizontal padding on a 320px phone — 15% of the viewport spent on margins.
// The shell now applies responsive padding itself; this component exists so a
// page can declare its own measure and rhythm without inventing new numbers.
//
// Every new responsive page should use it. Existing pages are unaffected: they
// simply do not use it yet, and inherit the shell's padding as before.
//
// NOTE: the page *title* row lives in `@/components/shared/page-header`, which
// is canonical and used by 97 pages. Phase 2 briefly defined a second
// `PageHeader` here; it was removed in Phase 5A because it duplicated that
// component with a different visual identity.

const WIDTHS = {
  /** Reading measure — policy text, articles, single-column detail. */
  prose: "max-w-3xl",
  /** Forms and detail panes. */
  narrow: "max-w-5xl",
  /** The default for list and dashboard pages. */
  default: "max-w-[1600px]",
  /** Boards, wide tables, anything that wants the whole viewport. */
  full: "max-w-none",
} as const;

const GAPS = {
  none: "",
  sm: "space-y-3 sm:space-y-4",
  md: "space-y-4 sm:space-y-5 lg:space-y-6",
  lg: "space-y-6 sm:space-y-8 lg:space-y-10",
} as const;

export interface PageContainerProps extends React.ComponentProps<"div"> {
  /** Content measure. Default `default`. */
  width?: keyof typeof WIDTHS;
  /** Vertical rhythm between direct children. Default `md`. */
  gap?: keyof typeof GAPS;
  /**
   * Adds the horizontal padding itself. Leave `false` (the default) inside the
   * dashboard shell, which already pads its scroll region — turning it on there
   * would double the inset.
   */
  padded?: boolean;
}

export function PageContainer({
  width = "default",
  gap = "md",
  padded = false,
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0",
        WIDTHS[width],
        GAPS[gap],
        padded && "px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
      {...props}
    />
  );
}
