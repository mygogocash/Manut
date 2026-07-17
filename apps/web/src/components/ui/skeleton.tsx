import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        `
          bg-muted relative overflow-hidden rounded-md
          before:via-foreground/4 before:absolute before:inset-0
          before:-translate-x-full before:animate-[shimmer_2s_infinite]
          before:bg-linear-to-r before:from-transparent before:to-transparent
          dark:before:via-foreground/6
        `,
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
