import * as React from "react";

// One place that knows the breakpoints.
//
// Before this, `use-mobile.ts` hardcoded 768 and every other component that
// cared about width wrote its own Tailwind prefixes. That is fine for pure CSS,
// but any component that needs to *branch in JS* (render a card list instead of
// a table, a drawer instead of a dialog) needs the same numbers, or the CSS and
// the JS disagree at exactly one width and the layout tears.
//
// These values match Tailwind's defaults deliberately, so `useBreakpoint()` and
// a `md:` prefix always agree. Do not change one without the other.

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Subscribes to a media query.
 *
 * Returns `false` on the server and until the first effect runs — a component
 * that would render *differently* rather than merely *behave* differently
 * should either accept a desktop-first first paint or branch in CSS instead.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setMatches(e.matches);

    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True below `bp`. `useIsBelow("md")` is "narrower than 768px". */
export function useIsBelow(bp: Breakpoint): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS[bp] - 1}px)`);
}

/** True at `bp` and wider. */
export function useIsAtLeast(bp: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[bp]}px)`);
}

export interface BreakpointState {
  /** < 640px */
  isMobile: boolean;
  /** 640px – 1023px */
  isTablet: boolean;
  /** >= 1024px */
  isDesktop: boolean;
  /**
   * < 768px. The line the shell actually switches on — the sidebar has used it
   * since before this hook existed, and tables/dialogs match it so a 768px
   * tablet keeps the desktop treatment.
   */
  isCompact: boolean;
  /** True until the first effect resolves; useful for suppressing a layout flash. */
  isResolving: boolean;
}

/**
 * The three device classes from the Phase 1 brief, plus `isCompact` for the
 * shell's own 768px line. Prefer Tailwind prefixes for pure styling; reach for
 * this only when the DOM itself must differ.
 */
export function useBreakpoint(): BreakpointState {
  const isMobile = useIsBelow("sm");
  const isCompact = useIsBelow("md");
  const isDesktop = useIsAtLeast("lg");
  const [resolved, setResolved] = React.useState(false);

  React.useEffect(() => setResolved(true), []);

  return {
    isMobile,
    isTablet: !isMobile && !isDesktop,
    isDesktop,
    isCompact,
    isResolving: !resolved,
  };
}
