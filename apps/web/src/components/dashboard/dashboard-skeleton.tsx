import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div
        className={`
          grid grid-cols-2 gap-3
          xl:grid-cols-4
        `}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-xl" />
        ))}
      </div>
      <div
        className={`
          grid grid-cols-1 gap-5
          lg:grid-cols-3
        `}
      >
        <div
          className={`
            flex flex-col gap-5
            lg:col-span-2
          `}
        >
          <Skeleton className="min-h-[300px] rounded-xl" />
          <Skeleton className="min-h-[220px] rounded-xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="min-h-[280px] rounded-xl" />
          <Skeleton className="min-h-[200px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
