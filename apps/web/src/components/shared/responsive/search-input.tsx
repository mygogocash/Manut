"use client";

import { Search, X } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// A search field, and nothing else.
//
// No fetching, no query building, no URL syncing — the caller owns all of that,
// because every module searches different things through its own service. This
// owns the input affordances that were being re-implemented per screen: the
// icon, a clear button that actually clears, a loading indicator that does not
// displace the layout, and Escape-to-clear.
//
// Debouncing is opt-in. It is wrong by default: a search that only runs on
// submit should fire immediately, and a debounce on a client-side filter just
// makes typing feel broken.

export interface SearchInputProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "value" | "type"
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Milliseconds to wait before reporting a change. 0 (default) reports immediately. */
  debounceMs?: number;
  /** Shows a spinner in place of the clear button. */
  loading?: boolean;
  /** Accessible name. Defaults to the placeholder, then to "Search". */
  label?: string;
  containerClassName?: string;
}

export function SearchInput({
  value,
  onValueChange,
  debounceMs = 0,
  loading = false,
  label,
  placeholder = "Search…",
  className,
  containerClassName,
  disabled,
  ...props
}: SearchInputProps) {
  // Local copy so the field stays responsive to typing while a debounced
  // parent update is still pending.
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const onValueChangeRef = React.useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  // Follow the parent when it changes the value itself (a reset, a URL restore).
  React.useEffect(() => setDraft(value), [value]);

  React.useEffect(() => {
    if (debounceMs <= 0) return;
    if (draft === value) return;
    const t = window.setTimeout(
      () => onValueChangeRef.current(draft),
      debounceMs,
    );
    return () => window.clearTimeout(t);
  }, [draft, debounceMs, value]);

  const commit = (next: string) => {
    setDraft(next);
    if (debounceMs <= 0) onValueChange(next);
  };

  const clear = () => {
    setDraft("");
    onValueChange("");
    inputRef.current?.focus();
  };

  const showClear = draft.length > 0 && !loading && !disabled;

  return (
    <div className={cn("relative min-w-0", containerClassName)}>
      <Search
        className={`
          text-muted-foreground pointer-events-none absolute top-1/2 left-2.5
          size-4 -translate-y-1/2
        `}
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={
          label ?? (typeof placeholder === "string" ? placeholder : "Search")
        }
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && draft) {
            // Clear rather than blur — Escape in a search field is understood
            // as "undo my query", and blurring loses the keyboard on mobile.
            e.preventDefault();
            e.stopPropagation();
            clear();
          }
        }}
        className={cn(
          // 16px on mobile: anything smaller makes iOS Safari zoom the viewport
          // on focus, which the user then has to pinch back out of.
          "h-10 pr-9 pl-8 text-base",
          "sm:h-9 sm:text-sm",
          // Chrome/Safari draw their own clear affordance on type=search.
          "[&::-webkit-search-cancel-button]:appearance-none",
          className,
        )}
        {...props}
      />

      {loading && (
        <Spinner
          className={`
            text-muted-foreground absolute top-1/2 right-3 size-4
            -translate-y-1/2
          `}
        />
      )}

      {showClear && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className={`
            text-muted-foreground absolute top-1/2 right-1.5 flex size-7
            -translate-y-1/2 items-center justify-center rounded-full
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:outline-none
            hover:text-foreground
          `}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
