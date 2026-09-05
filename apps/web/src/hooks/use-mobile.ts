import { useIsBelow } from "@/hooks/use-breakpoint";

/**
 * True below 768px.
 *
 * Kept as-is because the sidebar's mobile-drawer behaviour is built on this
 * exact threshold; changing it would move which widths get a drawer instead of
 * a docked sidebar. It now delegates to `use-breakpoint` so there is a single
 * definition of the breakpoints — see the note in that file.
 */
export function useIsMobile() {
  return useIsBelow("md");
}
