"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Route-based tabs for the Marketing CRM area. Kept as links (not
// in-page state) so the heavy partner list page and the campaign /
// dashboard pages stay independent routes.
const TABS = [
  { label: "Partners", href: "/partners", exact: true },
  { label: "Campaigns", href: "/partners/campaigns", exact: false },
  { label: "OW Dashboard", href: "/partners/dashboard", exact: false },
];

export function MarketingCrmTabs() {
  const pathname = usePathname();
  return (
    <div className="border-border flex gap-1 border-b">
      {TABS.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              `
                -mb-px border-b-2 px-3 py-2 text-sm font-medium
                transition-colors
              `,
              active
                ? "border-foreground text-foreground"
                : `
                  text-muted-foreground border-transparent
                  hover:text-foreground
                `,
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
