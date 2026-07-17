import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  icon,
  children,
  className,
  action,
}: {
  title: string;
  /** Optional short line under the title */
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * Right-aligned slot rendered next to the title. Typically a "Add"
   * affordance gated by the caller's permission.
   */
  action?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        `
          border-border/80 bg-card/90 gap-0 overflow-hidden rounded-xl shadow-sm
          backdrop-blur-sm
        `,
        className,
      )}
    >
      <CardHeader
        className={cn(
          "border-border/60 flex flex-row items-start gap-3 border-b px-5 py-4",
        )}
      >
        <div
          className={`
            bg-primary/10 text-primary flex size-10 shrink-0 items-center
            justify-center rounded-xl
          `}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <CardTitle
            className={`
              text-muted-foreground text-[11px] font-semibold tracking-[0.08em]
              uppercase
            `}
          >
            {title}
          </CardTitle>
          {description ? (
            <CardDescription
              className={`
                text-foreground-secondary mt-1.5 text-[13px] leading-relaxed
                normal-case
              `}
            >
              {description}
            </CardDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  );
}
