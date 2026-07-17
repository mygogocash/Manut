import { ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div
            className={`
              bg-primary/10 text-primary flex size-9 items-center justify-center
              rounded-lg
            `}
          >
            <Icon className="size-4" />
          </div>
          {trend !== undefined && trend !== 0 && (
            <div
              className={`
                flex items-center gap-0.5 text-[11px] font-semibold
                ${trend > 0 ? `text-success` : `text-destructive`}
              `}
            >
              {trend > 0 ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="text-foreground mt-3 text-xl font-semibold tabular-nums">
          {value}
        </p>
        <p
          className={`
            text-muted-foreground mt-0.5 text-[11px] font-medium tracking-wide
          `}
        >
          {title}
        </p>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 text-[10px]">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}
