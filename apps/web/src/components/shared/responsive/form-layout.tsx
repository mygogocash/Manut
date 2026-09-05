import * as React from "react";

import { cn } from "@/lib/utils";

// Responsive form scaffolding.
//
// Not a form library and not a replacement for `ui/form.tsx` — the 102 existing
// `useForm` call sites keep react-hook-form + zodResolver exactly as they are.
// This only owns *layout*: how fields stack, how a section is separated, and
// where the actions sit once a keyboard covers the bottom third of the screen.

/** Fields stack on mobile and pair from `sm` up. */
export function FormRow({
  className,
  columns = 2,
  ...props
}: React.ComponentProps<"div"> & { columns?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        `
          grid min-w-0 gap-3
          sm:gap-4
        `,
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
      {...props}
    />
  );
}

/** A titled group of fields. */
export function FormSection({
  title,
  description,
  className,
  children,
  ...props
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
} & Omit<React.ComponentProps<"section">, "title">) {
  return (
    <section
      className={cn(
        `
          min-w-0 space-y-3
          sm:space-y-4
        `,
        className,
      )}
      {...props}
    >
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          )}
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * The action bar for a form.
 *
 * Sticky at the bottom on mobile, static on desktop. Two details matter:
 *
 *   - `pb-safe-offset-4` keeps Save clear of the iOS home indicator, which
 *     otherwise sits directly on top of it.
 *   - Buttons are full-width and reversed on mobile (primary last in DOM order
 *     but first visually via `flex-col-reverse`), so the primary action lands
 *     under the thumb and tab order still reaches Cancel first.
 */
export function StickyActionBar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        `
          bg-surface border-border sticky bottom-0 z-10 -mx-4 flex
          flex-col-reverse gap-2 border-t px-4 pt-3
          sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:px-0
          sm:pb-0
        `,
        `
          pb-safe-offset-4
          sm:pb-0
        `,
        /* Children go full-width on mobile, natural width from sm up. */
        `
          [&>*]:w-full
          sm:[&>*]:w-auto
        `,
        className,
      )}
      {...props}
    />
  );
}

/**
 * Wraps the scrollable body of a form so the sticky bar has something to sit
 * against and long forms do not push the actions off-screen.
 */
export function FormBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        `
          min-w-0 space-y-4
          sm:space-y-5
        `,
        className,
      )}
      {...props}
    />
  );
}
