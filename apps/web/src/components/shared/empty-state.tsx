import { InboxIcon } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Compact variant for inline contexts like SectionCards. */
  compact?: boolean;
}

export function EmptyState({
  title = "No data",
  description,
  icon,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <Empty
      className={cn("border-0", compact ? "gap-2 py-6" : "py-16", className)}
    >
      <EmptyHeader>
        <EmptyMedia
          className={cn(
            "text-muted-foreground",
            compact && "mb-0 [&_svg]:size-5",
          )}
        >
          {icon || <InboxIcon size={compact ? 20 : 32} />}
        </EmptyMedia>
        <EmptyTitle
          className={cn(
            "text-foreground-secondary font-medium",
            compact ? "text-[13px]" : "text-[14px]",
          )}
        >
          {title}
        </EmptyTitle>
        {description && (
          <EmptyDescription
            className={cn(compact ? "text-[11px]" : "text-[12px]")}
          >
            {description}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
