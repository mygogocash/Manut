"use client";

import {
  ArrowUpRight,
  CalendarClock,
  CalendarPlus,
  Clock3,
  FileText,
  FolderKanban,
  Gavel,
  ListChecks,
  MapPin,
  Receipt,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { timeAgo } from "@/components/dashboard/dashboard-utils";
import { SectionCard } from "@/components/dashboard/section-card";
import { Badge } from "@/components/shared/badge";
import { useAuth } from "@/providers/auth-provider";

type PendingAction = {
  kind:
    | "leave"
    | "travel"
    | "expense"
    | "project_review"
    | "department_review"
    | "business_head_review"
    | "product_admin_review"
    | "development_scheduling"
    | "task_assignment";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
};

const KIND_META: Record<
  PendingAction["kind"],
  { label: string; icon: React.ReactNode; accent: string }
> = {
  leave: {
    label: "Leave",
    icon: <CalendarPlus className="size-4" aria-hidden />,
    accent: "bg-warning/10 text-warning",
  },
  travel: {
    label: "Travel",
    icon: <MapPin className="size-4" aria-hidden />,
    accent: "bg-primary/10 text-primary",
  },
  expense: {
    label: "Expense",
    icon: <Receipt className="size-4" aria-hidden />,
    accent: "bg-info/10 text-info",
  },
  // AI Project Orchestrator — Phase 2 PM review queue item.
  project_review: {
    label: "Project",
    icon: <FolderKanban className="size-4" aria-hidden />,
    accent: "bg-primary/10 text-primary",
  },
  // AI Project Orchestrator — Phase 3 department review assignment.
  department_review: {
    label: "Review",
    icon: <FolderKanban className="size-4" aria-hidden />,
    accent: "bg-info/10 text-info",
  },
  // AI Project Orchestrator — Phase 4 executive approval gates.
  business_head_review: {
    label: "Approval",
    icon: <Gavel className="size-4" aria-hidden />,
    accent: "bg-primary/10 text-primary",
  },
  product_admin_review: {
    label: "Final",
    icon: <ShieldCheck className="size-4" aria-hidden />,
    accent: "bg-primary/10 text-primary",
  },
  // AI Project Orchestrator — Phase 5 development scheduling queue.
  development_scheduling: {
    label: "Schedule",
    icon: <CalendarClock className="size-4" aria-hidden />,
    accent: "bg-info/10 text-info",
  },
  // AI Project Orchestrator — Phase 6 generated task assignment.
  task_assignment: {
    label: "Task",
    icon: <ListChecks className="size-4" aria-hidden />,
    accent: "bg-primary/10 text-primary",
  },
};

export function DashboardQuickActions({
  actions,
}: {
  actions: PendingAction[];
}) {
  const { hasAnyPermission } = useAuth();
  const canViewDirectory = hasAnyPermission("user:read");
  const visible = actions.slice(0, 6);

  return (
    <SectionCard
      title="Pending actions"
      description="Latest items waiting on you or the team."
      icon={<Zap className="size-4" aria-hidden />}
    >
      {visible.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {visible.map((action) => {
            const meta = KIND_META[action.kind];
            return (
              <Link
                key={action.id}
                href={action.href}
                className={`
                  group/action border-border/60 bg-muted/10 flex items-start
                  gap-3 rounded-xl border px-3 py-3 transition-colors
                  hover:bg-muted/30
                `}
              >
                <div
                  className={`
                    ${meta.accent}
                    mt-0.5 flex size-9 shrink-0 items-center justify-center
                    rounded-lg
                  `}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`
                          text-foreground-secondary truncate text-xs
                          font-semibold
                        `}
                      >
                        {action.title}
                      </p>
                      <p
                        className={`
                          text-muted-foreground mt-0.5 truncate text-[11px]
                          leading-snug
                        `}
                      >
                        {action.subtitle}
                      </p>
                    </div>
                    <Badge status="pending">{meta.label}</Badge>
                  </div>
                  <div
                    className={`
                      text-muted-foreground mt-2 flex items-center gap-1.5
                      text-[10px]
                    `}
                  >
                    <Clock3 className="size-3.5 shrink-0" aria-hidden />
                    <span>{timeAgo(action.createdAt)}</span>
                  </div>
                </div>
                <ArrowUpRight
                  className={`
                    text-muted-foreground mt-0.5 size-3.5 shrink-0 opacity-50
                    transition
                    group-hover/action:translate-x-0.5
                    group-hover/action:opacity-90
                  `}
                  aria-hidden
                />
              </Link>
            );
          })}
          {canViewDirectory && (
            <Link
              href="/directory"
              className={`
                border-border/60 text-muted-foreground flex items-center
                justify-between rounded-xl border px-3 py-3 text-xs
                transition-colors
                hover:bg-muted/25
              `}
            >
              <span>Browse directory</span>
              <Users className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <FileText className="size-4" aria-hidden />
          <span>No pending actions right now.</span>
        </div>
      )}
    </SectionCard>
  );
}
