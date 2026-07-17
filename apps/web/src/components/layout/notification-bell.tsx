"use client";

import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  MessageSquare,
  Newspaper,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/providers/auth-provider";
import {
  type DashboardStats,
  getDashboardStats,
} from "@/services/dashboard.service";

const POLL_INTERVAL_MS = 60_000;
// Bumped storage key version (`-v2`) so the badge resets cleanly on
// the rollout — earlier builds stored a single `last-seen-at`
// timestamp, but urgent items synth their `createdAt` to "now" on
// every poll, so any timestamp that wasn't `Date.now()` left them
// counted as unread again after a couple of polling intervals.
// Switching to a per-id "seen" set fixes that without breaking the
// approval / news flows.
const SEEN_IDS_KEY = "manut:notifications:seen-ids-v2";
// Cap on stored ids so a long-running tab with thousands of past
// notifications doesn't bloat localStorage. New ids land at the tail;
// the oldest get evicted when the cap is hit.
const SEEN_IDS_CAP = 500;

// Human label for a CRM `module` value (deadline + update bell rows carry it
// so the shared group can name the source CRM). Falls back to the raw key.
const CRM_LABELS: Record<string, string> = {
  it: "IT CRM",
  general: "Project CRM",
  product: "Product CRM",
  legal: "Legal CRM",
  accounting: "Accounting CRM",
  hr: "HR CRM",
  qa: "QA CRM",
  marketing: "Marketing CRM",
};
const crmLabel = (module: string) => CRM_LABELS[module] ?? module;

type NotificationItem = {
  id: string;
  group: "approval" | "survey" | "urgent" | "it-crm" | "it-crm-update" | "news";
  title: string;
  subtitle?: string;
  href?: string;
  createdAt: string;
  icon: React.ReactNode;
  iconClass: string;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Keep insertion order + trim from the head when capped. New ids
    // were added last so the tail is "freshest"; the oldest entries
    // are safe to drop because their notifications are long gone
    // from the pendingActions / urgentItems feeds.
    const arr = [...ids];
    const trimmed =
      arr.length > SEEN_IDS_CAP ? arr.slice(arr.length - SEEN_IDS_CAP) : arr;
    window.localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota / private-mode failures don't break the bell — the badge
    // just resets to "everything unread" on the next page load.
  }
}

const APPROVAL_ICON: Record<
  "leave" | "travel" | "expense",
  { icon: React.ReactNode; iconClass: string }
> = {
  leave: {
    icon: <CalendarClock className="size-3.5" aria-hidden />,
    iconClass: "bg-warning/10 text-warning",
  },
  travel: {
    icon: <MapPin className="size-3.5" aria-hidden />,
    iconClass: "bg-primary/10 text-primary",
  },
  expense: {
    icon: <Receipt className="size-3.5" aria-hidden />,
    iconClass: "bg-info/10 text-info",
  },
};

function buildItems(stats: DashboardStats | null): NotificationItem[] {
  if (!stats) return [];

  const out: NotificationItem[] = [];

  for (const a of stats.pendingActions) {
    const m = APPROVAL_ICON[a.kind];
    out.push({
      id: `approval-${a.kind}-${a.id}`,
      group: "approval",
      title: a.title,
      subtitle: `${a.subtitle} · awaiting your approval`,
      href: a.href,
      createdAt: a.createdAt,
      icon: m.icon,
      iconClass: m.iconClass,
    });
  }

  // urgentItems carry no real createdAt. Earlier builds synthesised
  // `new Date().toISOString()` on every fetch, which meant the
  // timestamp drifted forward on each poll and the timestamp-based
  // "seen" check never caught up — the same item showed unread again
  // a few minutes later. Now we just freeze the timestamp at the
  // start of `buildItems` and rely on the per-id seen set; the
  // string only affects display order.
  const itemsBuildIso = new Date().toISOString();
  for (const u of stats.urgentItems) {
    out.push({
      id: `urgent-${u.label}`,
      group: "urgent",
      title: u.label,
      subtitle: u.severity === "urgent" ? "Action recommended" : "Pending",
      createdAt: itemsBuildIso,
      icon: <AlertTriangle className="size-3.5" aria-hidden />,
      iconClass: "bg-destructive/10 text-destructive",
    });
  }

  for (const s of stats.openSurveys ?? []) {
    out.push({
      id: `survey-${s.id}`,
      group: "survey",
      title: `Survey: ${s.title}`,
      subtitle: "Tap to respond",
      href: s.href,
      createdAt: s.createdAt,
      icon: <ClipboardList className="size-3.5" aria-hidden />,
      iconClass: "bg-primary/10 text-primary",
    });
  }

  for (const r of stats.itCrmReminders ?? []) {
    const label =
      r.daysLeft < 0
        ? `overdue by ${Math.abs(r.daysLeft)}d`
        : r.daysLeft === 0
          ? "due today"
          : `due in ${r.daysLeft}d`;
    out.push({
      id: r.id,
      group: "it-crm",
      title: r.kind === "project" ? `Go-live: ${r.title}` : `Task: ${r.title}`,
      subtitle: `${crmLabel(r.module)} · ${label} (${r.dueDate})`,
      href: r.href,
      createdAt: itemsBuildIso,
      icon: <CalendarClock className="size-3.5" aria-hidden />,
      iconClass:
        r.daysLeft < 0
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-500/10 text-amber-600",
    });
  }

  for (const u of stats.itCrmUpdates ?? []) {
    out.push({
      id: u.id,
      group: "it-crm-update",
      title: u.title,
      subtitle: u.body
        ? `${crmLabel(u.module)} · ${u.body}`
        : crmLabel(u.module),
      href: u.href ?? undefined,
      createdAt: u.createdAt,
      icon: <MessageSquare className="size-3.5" aria-hidden />,
      iconClass: "bg-primary/10 text-primary",
    });
  }

  for (const n of stats.recentNews.slice(0, 3)) {
    out.push({
      id: `news-${n.id}`,
      group: "news",
      title: n.title,
      subtitle: n.author,
      createdAt: n.createdAt,
      icon: <Newspaper className="size-3.5" aria-hidden />,
      iconClass: "bg-muted text-muted-foreground",
    });
  }

  return out.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSeenIds(readSeenIds());
  }, []);

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await getDashboardStats();
      setStats(res.data);
    } catch {
      // Bell is best-effort — silent on transient failures.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void fetchStats();
    const id = window.setInterval(() => void fetchStats(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchStats]);

  const items = useMemo(() => buildItems(stats), [stats]);

  // Unread = anything in `approval`/`urgent` whose stable id isn't
  // in the persisted seen set. Switching from a timestamp threshold
  // to a per-id check fixes the "same notification re-appears after
  // a few hours" bug: urgent items always carry the latest
  // `createdAt` (built from `Date.now()`), so a timestamp threshold
  // got stale by the very next poll.
  const unreadCount = useMemo(
    () => items.filter((i) => i.group !== "news" && !seenIds.has(i.id)).length,
    [items, seenIds],
  );

  const markAllRead = useCallback(() => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      for (const i of items) next.add(i.id);
      writeSeenIds(next);
      return next;
    });
  }, [items]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Defer the "mark read" so the badge doesn't disappear before the user sees it.
      markReadTimer.current = setTimeout(() => {
        markAllRead();
      }, 800);
    } else if (markReadTimer.current) {
      clearTimeout(markReadTimer.current);
      markReadTimer.current = null;
    }
  };

  // When the user clicks an item and navigates away, mark everything read
  // immediately — without this, a fast click (< 800ms) leaves the timer
  // un-fired so the same notifications keep appearing on every revisit.
  const onItemSelect = useCallback(() => {
    if (markReadTimer.current) {
      clearTimeout(markReadTimer.current);
      markReadTimer.current = null;
    }
    markAllRead();
    setOpen(false);
  }, [markAllRead]);

  if (!isAuthenticated) return null;

  const approvals = items.filter((i) => i.group === "approval");
  const surveys = items.filter((i) => i.group === "survey");
  const urgent = items.filter((i) => i.group === "urgent");
  const itCrm = items.filter((i) => i.group === "it-crm");
  const itCrmUpdates = items.filter((i) => i.group === "it-crm-update");
  const news = items.filter((i) => i.group === "news");

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className={`
            text-muted-foreground ring-offset-background relative inline-flex
            size-7 items-center justify-center rounded-md transition-colors
            hover:text-foreground
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:ring-offset-2 focus-visible:outline-none
          `}
        >
          <Bell className="size-4" aria-hidden />
          {unreadCount > 0 && (
            <span
              className={`
                bg-destructive text-destructive-foreground absolute -top-0.5
                -right-0.5 inline-flex h-4 min-w-4 items-center justify-center
                rounded-full px-1 text-[9px] font-bold tabular-nums
              `}
              aria-hidden
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={`
          w-[360px] gap-0 p-0
          sm:w-[400px]
        `}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p
            className={`
              text-muted-foreground text-[11px] font-semibold tracking-[0.08em]
              uppercase
            `}
          >
            Notifications
          </p>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className={`
                  text-primary text-[11px] font-medium transition-colors
                  focus-visible:ring-ring focus-visible:ring-2
                  focus-visible:ring-offset-2 focus-visible:outline-none
                  hover:underline
                `}
              >
                Mark all as read
              </button>
            )}
            <span className="text-muted-foreground text-[11px]">
              {items.length === 0
                ? "No activity"
                : `${items.length} item${items.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div
              className={`
                text-muted-foreground flex flex-col items-center gap-2 px-6
                py-10 text-center text-xs
              `}
            >
              <Bell className="text-muted-foreground/60 size-6" aria-hidden />
              <p className="font-medium">You&apos;re all caught up</p>
              <p className="text-muted-foreground/80 text-[11px]">
                Approvals, urgent items, and news will appear here.
              </p>
            </div>
          ) : (
            <>
              {approvals.length > 0 && (
                <Group label="Approvals needed" icon={<ClipboardCheck />}>
                  {approvals.map((i) => (
                    <Item key={i.id} item={i} onSelect={onItemSelect} />
                  ))}
                </Group>
              )}
              {surveys.length > 0 && (
                <Group label="Surveys to complete" icon={<ClipboardList />}>
                  {surveys.map((i) => (
                    <Item key={i.id} item={i} onSelect={onItemSelect} />
                  ))}
                </Group>
              )}
              {urgent.length > 0 && (
                <Group label="Urgent" icon={<AlertTriangle />}>
                  {urgent.map((i) => (
                    <Item key={i.id} item={i} onSelect={onItemSelect} />
                  ))}
                </Group>
              )}
              {itCrm.length > 0 && (
                <Group label="CRM deadlines" icon={<CalendarClock />}>
                  {itCrm.map((i) => (
                    <Item key={i.id} item={i} onSelect={onItemSelect} />
                  ))}
                </Group>
              )}
              {itCrmUpdates.length > 0 && (
                <Group label="CRM updates" icon={<MessageSquare />}>
                  {itCrmUpdates.map((i) => (
                    <Item key={i.id} item={i} onSelect={onItemSelect} />
                  ))}
                </Group>
              )}
              {news.length > 0 && (
                <Group label="Recent news" icon={<Newspaper />}>
                  {news.map((i) => (
                    <Item key={i.id} item={i} onSelect={onItemSelect} />
                  ))}
                </Group>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Group({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`
        border-b
        last:border-b-0
      `}
    >
      <div
        className={`
          text-muted-foreground bg-muted/30 flex items-center gap-1.5 px-4 py-2
          text-[10px] font-semibold tracking-[0.08em] uppercase
        `}
      >
        <span className="[&>svg]:size-3" aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <ul className="divide-border/60 flex flex-col divide-y">{children}</ul>
    </div>
  );
}

function Item({
  item,
  onSelect,
}: {
  item: NotificationItem;
  onSelect: () => void;
}) {
  const inner = (
    <div className="flex items-start gap-3 px-4 py-3">
      <div
        className={`
          ${item.iconClass}
          mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md
        `}
      >
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`
            text-foreground-secondary text-xs leading-snug font-medium
          `}
        >
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            {item.subtitle}
          </p>
        )}
      </div>
      {/* Relative time depends on the clock at render, so the server and
          client strings can differ by a minute on hydration — suppress
          the (cosmetic, self-correcting) mismatch on this text node. */}
      <span
        className="text-muted-foreground/80 shrink-0 text-[10px]"
        suppressHydrationWarning
      >
        {timeAgo(item.createdAt)}
      </span>
    </div>
  );

  if (item.href) {
    return (
      <li>
        <Link
          href={item.href}
          onClick={onSelect}
          className={`
            hover:bg-muted/40
            block transition-colors
          `}
        >
          {inner}
        </Link>
      </li>
    );
  }
  return <li>{inner}</li>;
}
