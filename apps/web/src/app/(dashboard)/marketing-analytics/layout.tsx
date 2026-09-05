import { notFound } from "next/navigation";

import { MARKETING_ANALYTICS_ENABLED } from "@/lib/feature-flags";

/**
 * Ship-dark guard for the whole Marketing Analytics family.
 *
 * One layout covers all eight routes under `/marketing-analytics` — a guard
 * per page would be eight chances to forget one, and a page added later would
 * arrive unguarded by default. This way the default is closed.
 *
 * Hiding the sidebar entries is not enough on its own: those routes stay
 * reachable by typing the URL, and a permission gate would not help either
 * because Admin bypasses every permission check. The API mount is gated in
 * parallel, so even a rendered page would have no endpoints to call.
 */
export default function MarketingAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!MARKETING_ANALYTICS_ENABLED) notFound();
  return <>{children}</>;
}
