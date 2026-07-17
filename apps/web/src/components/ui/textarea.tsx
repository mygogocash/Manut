import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  // Mirror the Input primitive's id/name fallback. Chrome's
  // autofill hint persists unless the field carries an id or a
  // name; `autocomplete="off"` alone is not enough.
  const generatedId = React.useId();
  const unnamed =
    !props.id &&
    !props.name &&
    !props["aria-label"] &&
    !props["aria-labelledby"];
  const placeholderLabel =
    unnamed && typeof props.placeholder === "string"
      ? props.placeholder.replace(/[…….]+$/, "").trim()
      : undefined;
  const fallbackAutoComplete =
    unnamed && !props.autoComplete ? "off" : undefined;
  const fallbackId = !props.id && !props.name ? generatedId : undefined;
  return (
    <textarea
      data-slot="textarea"
      {...(fallbackId ? { id: fallbackId } : {})}
      {...(placeholderLabel ? { "aria-label": placeholderLabel } : {})}
      {...(fallbackAutoComplete ? { autoComplete: fallbackAutoComplete } : {})}
      className={cn(
        `
          border-input flex field-sizing-content min-h-16 w-full rounded-lg
          border bg-transparent px-2.5 py-2 text-base transition-colors
          outline-none
          placeholder:text-muted-foreground
          hover:border-ring/40
          focus-visible:border-ring focus-visible:ring-ring/30
          focus-visible:ring-3
          disabled:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60
          aria-invalid:border-destructive aria-invalid:ring-destructive/20
          aria-invalid:ring-3
          dark:bg-input/30 dark:disabled:bg-input/80
          dark:aria-invalid:border-destructive/50
          dark:aria-invalid:ring-destructive/40
          md:text-sm
        `,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
