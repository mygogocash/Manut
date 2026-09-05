"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persist the active tab of a page in the URL query string (`?tab=…`) so a
 * hard reload (or a shared link) lands on the same tab instead of snapping
 * back to the default.
 *
 * Deliberately uses the History API (`window.history.replaceState`) rather
 * than `useSearchParams` / the Next router:
 *  - no `<Suspense>` boundary requirement (useSearchParams forces one),
 *  - no navigation / top-loading-bar on a mere tab switch,
 *  - the URL update replaces (doesn't push) so the back button isn't polluted.
 *
 * The initial value is read from the URL in an effect (client-only) to avoid
 * any SSR/hydration mismatch — on reload the tab syncs from the URL on mount.
 *
 * Drop-in for both tab systems:
 *   const [tab, setTab] = useTabParam("overview");
 *   <Tabs active={tab} onChange={setTab}>            // shared/tabs
 *   <Tabs value={tab} onValueChange={setTab}>        // radix ui/tabs
 */
export function useTabParam(
  defaultTab: string,
  key = "tab",
): readonly [string, (next: string) => void] {
  const [tab, setTabState] = useState(defaultTab);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl) setTabState(fromUrl);
  }, [key]);

  const setTab = useCallback(
    (next: string) => {
      setTabState(next);
      const params = new URLSearchParams(window.location.search);
      params.set(key, next);
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    },
    [key],
  );

  return [tab, setTab] as const;
}
