import { Skeleton } from "@/components/ui/skeleton";

export function CrmSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div
        className={`
          grid gap-4
          md:grid-cols-4
        `}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[200px] rounded-lg" />
      <div
        className={`
          grid gap-4
          md:grid-cols-2
        `}
      >
        <Skeleton className="h-[250px] rounded-lg" />
        <Skeleton className="h-[250px] rounded-lg" />
      </div>
    </div>
  );
}
