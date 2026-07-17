import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex items-start justify-between", className)}>
      <div>
        <h1
          className={`
            text-foreground font-serif text-3xl leading-tight font-normal
            tracking-tight
          `}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 pt-0.5">{children}</div>
      )}
    </div>
  );
}
