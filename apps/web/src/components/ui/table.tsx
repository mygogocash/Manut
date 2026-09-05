"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface TableProps extends React.ComponentProps<"table"> {
  /**
   * Extra classes applied to the wrapper `<div>` that owns the
   * horizontal scroll context. Use this to push `max-h-[...]` +
   * `overflow-auto` so the wrapper becomes the vertical scroll
   * context too — required for `position: sticky` on TableHeader
   * to pin against the table viewport rather than the page.
   */
  containerClassName?: string;
}

function Table({ className, containerClassName, ...props }: TableProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = React.useState(false);

  // A horizontally scrolling table is only reachable by keyboard if the scroll
  // container can take focus. Making every container focusable would add a tab
  // stop to all ~93 tables, most of which never scroll — so the tab stop is
  // added ONLY while the table is actually wider than its container.
  //
  // One ResizeObserver per Table, watching the container and the table, and
  // `setScrollable` only ever receives a changed boolean, so a resize that does
  // not cross the threshold causes no re-render.
  React.useEffect(() => {
    const container = containerRef.current;
    const table = container?.firstElementChild;
    if (!container || !table) return;

    const measure = () => {
      const next = container.scrollWidth > container.clientWidth + 1;
      setScrollable((prev) => (prev === next ? prev : next));
    };
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(table);
    return () => ro.disconnect();
  }, []);

  // `role="region"` without an accessible name is itself a violation, so the
  // landmark is only claimed when the table has a name to borrow. An unnamed
  // scrolling table still becomes focusable — it can be scrolled, it just does
  // not pretend to be a landmark.
  const labelledBy = props["aria-labelledby"];
  const label = props["aria-label"];
  const named = Boolean(labelledBy ?? label);

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      data-scrollable={scrollable ? "true" : undefined}
      className={cn(
        `
          relative w-full overflow-x-auto
          focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none
        `,
        containerClassName,
      )}
      {...(scrollable
        ? {
            tabIndex: 0,
            ...(named
              ? {
                  role: "region",
                  "aria-labelledby": labelledBy,
                  "aria-label": labelledBy ? undefined : label,
                }
              : {}),
          }
        : {})}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        `
          bg-muted/50 border-t font-medium
          [&>tr]:last:border-b-0
        `,
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        `
          hover:bg-muted/50
          has-aria-expanded:bg-muted/50
          data-[state=selected]:bg-muted
          border-b transition-colors
        `,
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      // `scope="col"` so a screen reader can name the column a cell belongs to.
      // It matters most where a table is widest: Phase 8C put a 19-column
      // payroll matrix on the phone, and 19 unlabelled cells per row is not
      // readable. Checked against all 260 `TableHead` usages -- none sits inside
      // a `TableBody`, so every one is a column header. Declared before
      // `{...props}` so a caller can still override it.
      scope="col"
      className={cn(
        `
          text-foreground h-10 px-2 text-left align-middle font-medium
          whitespace-nowrap
          [&:has([role=checkbox])]:pr-0
        `,
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        `
          p-2 align-middle whitespace-nowrap
          [&:has([role=checkbox])]:pr-0
        `,
        // Below md, grow the HIT AREA of a control in a cell to 44px without
        // touching its painted size, so a table on a phone matches the 44px
        // floor Phase 7B-0 set for card actions. Row height is already 46-47px
        // and consecutive rows' controls sit 23px apart, so a 44px target fits
        // inside its own row — no row needs to get taller, and no two targets
        // can overlap. Measured before writing this.
        `
          max-md:[&_a]:relative max-md:[&_button]:relative
          max-md:[&_a]:after:absolute max-md:[&_button]:after:absolute
          max-md:[&_a]:after:inset-x-0 max-md:[&_button]:after:inset-x-0
          max-md:[&_a]:after:top-1/2 max-md:[&_button]:after:top-1/2
          max-md:[&_a]:after:h-11 max-md:[&_button]:after:h-11
          max-md:[&_a]:after:-translate-y-1/2
          max-md:[&_button]:after:-translate-y-1/2
          max-md:[&_a]:after:content-[''] max-md:[&_button]:after:content-['']
        `,
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
