import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: string;
  className?: string;
  accent?: boolean;
}

export function KpiCard({
  label,
  value,
  change,
  className,
  accent = false,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "border-border bg-surface gap-0 rounded-lg px-5 py-4",
        `
          shadow-sm transition-shadow
          hover:shadow-md
        `,
        accent && "border-l-2 border-l-primary",
        className,
      )}
    >
      <CardContent className="p-0">
        <div
          className={`
            text-muted-foreground mb-2 text-[9.5px] font-bold tracking-widest
            uppercase
          `}
        >
          {label}
        </div>
        <div
          className={`
            text-foreground font-sans text-[28px] leading-[1.1] font-light
          `}
        >
          {value}
        </div>
        {change && (
          <div
            className={`text-muted-foreground mt-1.5 text-[10.5px] leading-snug`}
          >
            {change}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
