import { cn } from "@/lib/utils";

// The canonical page title row. ~97 pages use it.
//
// Phase 5A made it responsive and deliberately did NOT restyle it. The serif
// `text-3xl` title is the app's established page-title identity; Phase 2 had
// briefly defined a second `PageHeader` under `responsive/` with a sans
// semibold `text-lg` title, and adopting that would have changed the look of
// every page in the product. That duplicate was removed instead.
//
// What changed is layout only, and only below `sm`:
//
//   - the row stacks, so a long title and its actions stop competing for one
//     line at 320px;
//   - the text column can shrink (`min-w-0`), without which a flex child
//     refuses to go narrower than its content and pushes the actions off-screen;
//   - actions wrap rather than overflowing;
//   - the title steps down one size on the narrowest screens, where a 30px
//     serif heading eats a third of the viewport.
//
// From `sm` upwards the rendering is unchanged: same size, same weight, same
// spacing, same `justify-between` row.

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Actions, rendered to the right on `sm` and up, below the title on mobile. */
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
    <div
      className={cn(
        `
          mb-4 flex flex-col gap-3
          sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4
        `,
        className,
      )}
    >
      {/* `min-w-0` is what lets a long title wrap instead of widening the row. */}
      <div className="min-w-0">
        <h1
          className={`
            text-foreground font-serif text-2xl leading-tight font-normal
            tracking-tight text-balance
            sm:text-3xl
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
        <div
          className={`
            flex shrink-0 flex-wrap items-center gap-2
            sm:pt-0.5
          `}
        >
          {children}
        </div>
      )}
    </div>
  );
}
