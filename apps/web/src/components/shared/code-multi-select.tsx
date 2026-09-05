"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export interface CodeOption {
  code: string;
  label: string;
}

interface CodeMultiSelectProps {
  options: CodeOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Shown when nothing is selected, e.g. "Select business units". */
  placeholder?: string;
  /** Rendered instead of the option list when there is nothing to pick. */
  emptyLabel?: string;
  disabled?: boolean;
}

/**
 * Toggle-list picker for a small set of codes, extracted from the Projects
 * form's Departments field so the six CRM forms that need a business-unit
 * picker share one implementation.
 *
 * Deliberately NOT a portalled Popover. Dialogs here use
 * react-remove-scroll, which blocks wheel/trackpad events over anything
 * portalled outside the dialog — the list could then only be moved by
 * dragging its scrollbar. Rendering the panel inside the dialog's own
 * subtree makes normal scrolling work. It stays in flow rather than
 * absolutely positioned because DialogContent is `overflow-y-auto` and
 * would clip an overlay.
 */
export function CodeMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyLabel = "Nothing to choose from yet",
  disabled = false,
}: CodeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Collapse when the form is closed out from under us.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  // Click-outside closes the panel. Listening on pointerdown (not click)
  // means a press that starts elsewhere in the dialog dismisses the list
  // before that element's own handler runs.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const labelFor = (code: string) =>
    options.find((o) => o.code === code)?.label ?? code;

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? labelFor(value[0] as string)
        : `${labelFor(value[0] as string)} +${value.length - 1} more`;

  return (
    <div ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`
          border-input bg-background flex h-9 w-full items-center
          justify-between rounded-md border px-3 text-sm
          disabled:cursor-not-allowed disabled:opacity-50
          ${value.length ? "" : "text-muted-foreground"}
        `}
      >
        <span className="truncate">{summary}</span>
        <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
      </button>
      {open ? (
        <div
          className={`
            bg-popover mt-1 max-h-56 overflow-y-auto rounded-md border p-1
          `}
        >
          {options.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              {emptyLabel}
            </p>
          ) : (
            options.map((o) => {
              const checked = value.includes(o.code);
              return (
                <button
                  key={o.code}
                  type="button"
                  onClick={() =>
                    // Selection order is preserved, so the first pick stays
                    // the one a collapsed chip row shows first.
                    onChange(
                      checked
                        ? value.filter((v) => v !== o.code)
                        : [...value, o.code],
                    )
                  }
                  className={`
                    hover:bg-accent
                    flex w-full items-center gap-2 rounded-sm px-2 py-1.5
                    text-left text-sm
                  `}
                >
                  <Check
                    className={`
                      size-3.5 shrink-0
                      ${checked ? "opacity-100" : "opacity-0"}
                    `}
                  />
                  {o.label}
                </button>
              );
            })
          )}
          <div
            className={`
              mt-1 flex items-center justify-between border-t px-2 pt-1.5
            `}
          >
            <span className="text-muted-foreground text-xs">
              {value.length === 0
                ? "None selected"
                : `${value.length} selected`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
