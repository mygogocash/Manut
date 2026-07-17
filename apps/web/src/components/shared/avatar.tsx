"use client";

import {
  Avatar as ShadcnAvatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: "size-6",
  md: "size-7",
  lg: "size-9",
};

const TEXT_SIZE_MAP = {
  sm: "text-[8px]",
  md: "text-[9px]",
  lg: "text-[11px]",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <ShadcnAvatar className={cn(SIZE_MAP[size], className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        className={cn(
          "text-sidebar-primary-foreground font-bold",
          TEXT_SIZE_MAP[size],
        )}
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
        }}
      >
        {getInitials(name)}
      </AvatarFallback>
    </ShadcnAvatar>
  );
}
