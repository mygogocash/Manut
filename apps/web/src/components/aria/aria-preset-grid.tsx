"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bitcoin,
  Briefcase,
  CalendarDays,
  Handshake,
  Inbox,
  Landmark,
  Plane,
  Radar,
  Rocket,
  Send,
  Target,
} from "lucide-react";

import { ARIA_PRESETS } from "@/components/aria/aria-presets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const PRESET_ICONS: Record<string, LucideIcon> = {
  financials: BarChart3,
  "investor-update": Send,
  anomalies: Radar,
  "series-b": Rocket,
  "crypto-memo": Bitcoin,
  partners: Handshake,
  bridge: Landmark,
  "payroll-compliance": Briefcase,
  "bd-pipeline": Target,
  "bd-account-status": Handshake,
  "hr-pending-approvals": Inbox,
  "hr-visa-watch": Plane,
  "calendar-week": CalendarDays,
};

export function AriaPresetGrid({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  const { hasAnyPermission } = useAuth();
  // Permission-tagged presets surface only when the caller actually
  // holds one of the gated codes — keeps the BD-flavoured chips off
  // the empty-state grid for employees without CRM access, and vice
  // versa. Untagged presets stay visible to everyone.
  const visiblePresets = ARIA_PRESETS.filter((p) => {
    if (!p.requiresAny || p.requiresAny.length === 0) return true;
    return hasAnyPermission(...p.requiresAny);
  });
  return (
    <div
      className={`
        mt-8 grid w-full max-w-2xl gap-2
        sm:grid-cols-2
      `}
    >
      {visiblePresets.map((p) => {
        const Icon = PRESET_ICONS[p.id] ?? BarChart3;
        return (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onPick(p.prompt)}
            className={cn(
              `
                border-border bg-background/50 h-auto flex-col items-start gap-1
                rounded-xl border px-3 py-3 text-left shadow-none
                hover:bg-muted/60
              `,
              "whitespace-normal",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <Icon className="text-muted-foreground size-4 shrink-0" />
              {p.label}
            </span>
            <span
              className={`
                text-muted-foreground pl-6 text-left text-[11px] leading-snug
                font-normal
              `}
            >
              {p.description}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
