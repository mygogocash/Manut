"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <Progress
      value={clampedValue}
      className={cn(
        `
          bg-border h-[5px] rounded-[3px]
          [&>[data-slot=progress-indicator]]:from-primary
          [&>[data-slot=progress-indicator]]:to-primary-light
          [&>[data-slot=progress-indicator]]:rounded-[3px]
          [&>[data-slot=progress-indicator]]:bg-gradient-to-r
        `,
        className,
      )}
    />
  );
}
