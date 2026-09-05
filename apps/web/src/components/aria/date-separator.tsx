import { cn } from "@/lib/utils";

/**
 * Renders a "Today" / "Yesterday" / "Mon, May 19" pill between chat
 * messages that cross a calendar-day boundary. The chat page computes
 * boundary points client-side based on `createdAt`; this component is
 * a pure presentation primitive.
 */
export function DateSeparator({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const label = formatSeparatorLabel(iso);
  return (
    <div
      className={cn("flex items-center justify-center py-2", className)}
      role="separator"
      aria-label={label}
    >
      <span
        className={`
          text-muted-foreground/70 bg-muted/40 border-border/40 rounded-full
          border px-2.5 py-0.5 text-[10px] font-medium tracking-wide uppercase
        `}
      >
        {label}
      </span>
    </div>
  );
}

export function formatSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  // Older messages get a short readable date (e.g. "Mon, May 19").
  // Drop the year unless it differs from today's year to keep the pill
  // compact.
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns true when `prevIso` and `currentIso` fall on different
 * calendar days in the viewer's local timezone. Used by the chat page
 * to decide where to inject a `<DateSeparator>` between messages.
 */
export function isNewDay(
  prevIso: string | undefined,
  currentIso: string,
): boolean {
  if (!prevIso) return true;
  const a = startOfDay(new Date(prevIso)).getTime();
  const b = startOfDay(new Date(currentIso)).getTime();
  return a !== b;
}
