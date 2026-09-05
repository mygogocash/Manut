"use client";

import { ARIA_PRESETS } from "@/components/aria/aria-presets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AriaPresetChips({
  onPick,
  disabled,
  className,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        `
          flex gap-1.5 overflow-x-auto pb-1
          [-ms-overflow-style:none]
          [scrollbar-width:none]
        `,
        "[&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {ARIA_PRESETS.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onPick(p.prompt)}
          className={`
            text-muted-foreground h-7 shrink-0 rounded-full px-2.5 text-[11px]
            font-normal
          `}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
