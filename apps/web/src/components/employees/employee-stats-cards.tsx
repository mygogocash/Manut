"use client";

import { CalendarPlus, UserCheck, Users, UserX } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UserStats } from "@/services/user.service";

interface StatCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

export interface EmployeeStatsCardLabels {
  total?: string;
  active?: string;
  inactive?: string;
  newThisMonth?: string;
}

interface EmployeeStatsCardsProps {
  stats: UserStats | null;
  loading?: boolean;
  /** Override default labels (e.g. Admin uses "Total users" instead of "Total employees"). */
  statLabels?: EmployeeStatsCardLabels;
}

export function EmployeeStatsCards({
  stats,
  loading,
  statLabels,
}: EmployeeStatsCardsProps) {
  if (loading || !stats) {
    return (
      <div
        className={`
          grid grid-cols-2 gap-3
          md:grid-cols-4
        `}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
    );
  }

  const cards: StatCard[] = [
    {
      label: statLabels?.total ?? "Total Employees",
      value: stats.total,
      icon: <Users className="size-4" />,
      color: "text-info bg-info/10",
    },
    {
      label: statLabels?.active ?? "Active",
      value: stats.active,
      icon: <UserCheck className="size-4" />,
      color: "text-success bg-success/10",
    },
    {
      label: statLabels?.inactive ?? "Inactive",
      value: stats.inactive,
      icon: <UserX className="size-4" />,
      color: "text-destructive bg-destructive/10",
    },
    {
      label: statLabels?.newThisMonth ?? "New This Month",
      value: stats.newThisMonth,
      icon: <CalendarPlus className="size-4" />,
      color: "text-primary bg-primary/10",
    },
  ];

  return (
    <div
      className={`
        grid grid-cols-2 gap-3
        md:grid-cols-4
      `}
    >
      {cards.map((card) => (
        <Card
          key={card.label}
          className={`
            border-border/80 bg-card/80 gap-0 p-4 shadow-sm backdrop-blur-sm
            transition-shadow
            hover:shadow-md
          `}
        >
          <CardContent className="flex items-center gap-3 p-0">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                card.color,
              )}
            >
              {card.icon}
            </div>
            <div className="min-w-0">
              <p
                className={`
                  text-foreground text-2xl font-semibold tracking-tight
                  tabular-nums
                `}
              >
                {card.value}
              </p>
              <p
                className={`
                  text-muted-foreground mt-0.5 truncate text-xs font-medium
                `}
              >
                {card.label}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
