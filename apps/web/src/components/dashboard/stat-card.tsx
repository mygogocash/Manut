import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACCENT: Record<"primary" | "info" | "success" | "warning", string> = {
  primary: "bg-primary/12 text-primary",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
};

export function StatCard({
  label,
  value,
  change,
  changeType,
  icon: Icon,
  accent = "primary",
  href,
}: {
  label: string;
  value: string;
  change: string;
  changeType: "up" | "down" | "neutral";
  icon: ComponentType<{ className?: string }>;
  accent?: keyof typeof ACCENT;
  /**
   * When set, wraps the card in a `next/link` so clicking navigates to
   * the deeper module surface. Keeps prefetch / client-side navigation
   * behaviour — `<a>` from a server-side href would force a full
   * reload and lose the dashboard's stat poll cache.
   */
  href?: string;
}) {
  const card = (
    <Card
      className={cn(
        `
          border-border/80 bg-card/85 gap-0 rounded-xl px-5 py-4 shadow-sm
          backdrop-blur-sm
        `,
        `
          transition-shadow
          hover:shadow-md
        `,
        href &&
          `
            cursor-pointer
            hover:border-foreground/20 hover:shadow-md
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:outline-none
          `,
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={`
                text-muted-foreground mb-2 text-[11px] font-semibold
                tracking-[0.08em] uppercase
              `}
            >
              {label}
            </p>
            <p
              className={`
                text-foreground font-serif text-[28px] leading-none font-normal
                tabular-nums
                sm:text-[30px]
              `}
            >
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              ACCENT[accent],
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-3 flex items-start gap-1.5">
          {changeType === "up" ? (
            <ArrowUp
              className="text-success mt-0.5 size-3.5 shrink-0"
              aria-hidden
            />
          ) : null}
          {changeType === "down" ? (
            <ArrowDown
              className="text-destructive mt-0.5 size-3.5 shrink-0"
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "text-xs leading-snug",
              changeType === "up" && "text-success",
              changeType === "down" && "text-destructive",
              changeType === "neutral" && "text-muted-foreground",
            )}
          >
            {change}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${label}: ${value}`}
        className={`
          block
          focus-visible:outline-none
        `}
      >
        {card}
      </Link>
    );
  }
  return card;
}
