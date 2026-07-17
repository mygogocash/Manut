"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CardGridSkeleton({ count }: { count: number }) {
  return (
    <div
      className={`
        grid grid-cols-1 gap-4
        md:grid-cols-2
        xl:grid-cols-3
        2xl:grid-cols-4
      `}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
      ))}
    </div>
  );
}
