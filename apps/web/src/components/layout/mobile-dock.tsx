"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { homeHref, homeSlot, workSlot } from "@/components/layout/dock-slots";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

/**
 * Longest-prefix match, mirroring `bestMatchHref` in `sidebar.tsx`.
 *
 * A first-match scan lights the wrong slot on nested routes, because
 * `/it-crm` is a prefix of `/it-crm/dashboard`. Resolved against the full
 * href list so a longer sibling wins.
 */
function isActive(pathname: string, href: string, all: string[]): boolean {
  const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  if (!matches(href)) return false;
  return !all.some(
    (other) => other !== href && matches(other) && other.length > href.length,
  );
}

/**
 * App-style navigation for phones.
 *
 * Three derived slots plus More, which opens the sidebar Sheet that already
 * exists — so all 67 routes stay reachable without inventing a second nav
 * taxonomy, and there is one drawer implementation rather than two.
 *
 * Slots are derived, never configured: Home follows the persona rule in
 * `auth-provider` and is dropped when the actor cannot open it, Work is the
 * first nav destination they were explicitly granted, and Inbox renders the
 * notification bell itself.
 */
export function MobileDock() {
  const pathname = usePathname() ?? "";
  const { hasAnyPermission, isEmployeeOnly, isAuthenticated } = useAuth();
  const { setOpenMobile } = useSidebar();

  const home = homeSlot(hasAnyPermission, isEmployeeOnly);
  const work = workSlot(
    hasAnyPermission,
    isEmployeeOnly,
    homeHref(isEmployeeOnly),
  );

  if (!isAuthenticated) return null;

  // Each keeps the icon from its own NAV_GROUPS entry — a generic glyph would
  // make the slot unrecognisable against the sidebar row it points at.
  const links = [home, work].filter(Boolean) as NonNullable<typeof home>[];
  const hrefs = links.map((l) => l.href);

  return (
    <nav
      aria-label="Primary"
      className={`
        bg-background border-border pb-safe fixed inset-x-0 bottom-0 z-40 flex
        border-t
        md:hidden
      `}
    >
      {links.map(({ id, label, href, icon: Icon }) => {
        const active = isActive(pathname, href, hrefs);
        return (
          <Link
            key={id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              `
                flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]
                transition-colors
              `,
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}

      <NotificationBell variant="dock" />

      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        aria-label="More navigation"
        className={`
          text-muted-foreground flex flex-1 flex-col items-center gap-0.5 py-2
          text-[11px] transition-colors
          hover:text-foreground
        `}
      >
        <Menu className="size-5" aria-hidden />
        More
      </button>
    </nav>
  );
}
