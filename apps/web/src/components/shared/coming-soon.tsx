"use client";

import { Construction } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface ComingSoonProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ComingSoon({
  title = "Coming Soon",
  description = "This feature is under development and will be available soon.",
  icon,
  className,
}: ComingSoonProps) {
  return (
    <Empty className={cn("border-0 py-20", className)}>
      <EmptyHeader>
        <EmptyMedia className="text-muted-foreground">
          {icon ?? <Construction className="size-8" />}
        </EmptyMedia>
        <EmptyTitle className="text-foreground text-lg font-semibold">
          {title}
        </EmptyTitle>
        <EmptyDescription className="max-w-md text-sm">
          {description}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
