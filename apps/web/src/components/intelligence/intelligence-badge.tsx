import { cn } from "@/lib/utils";

/**
 * "✦ Manut Intelligence" motif (Brand CI §24) — marks content that was
 * created or interpreted by Manut's AI. The four-point sparkle is the
 * intelligence mark; it never goes in the primary logo.
 */
export function IntelligenceBadge({
  label = "Manut Intelligence",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 self-start rounded-full bg-intelligence-50 px-2.5 py-1 text-[11px] font-medium uppercase leading-none tracking-wide text-intelligence-900",
        className,
      )}
    >
      <span aria-hidden>✦</span>
      {label}
    </span>
  );
}
