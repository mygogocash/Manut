"use client";

import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { useTableLayout } from "@/components/shared/use-table-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

type Layout = ReturnType<typeof useTableLayout>;

/**
 * Per-table column controls: show/hide, reset to the organisation default,
 * and — for admins — publish the current arrangement as that default.
 *
 * Reordering and resizing happen on the header itself (drag the header, drag
 * its edge); this menu covers what a header cannot express, namely a column
 * that is not currently on screen.
 */
export function TableCustomizeMenu({
  layout,
  labels,
}: {
  layout: Layout;
  /** Column key → the header text, so the menu reads like the table. */
  labels: Record<string, string>;
}) {
  const { hasPermission } = useAuth();
  const [saving, setSaving] = useState(false);
  const canManageDefault = hasPermission("admin:manage");

  // Hiding the last visible column would leave a table with no way back, so
  // the final checkbox is locked on.
  const visibleCount = layout.order.length - layout.hidden.length;

  async function publishDefault() {
    setSaving(true);
    try {
      await layout.saveAsDefault();
      toast.success("Saved as the default everyone sees");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not save the default",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="size-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p
          className={`
            text-muted-foreground px-2 py-1 text-[11px] tracking-wide uppercase
          `}
        >
          Show columns
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto p-1">
          {layout.order.map((key, i) => {
            const shown = !layout.isHidden(key);
            const isLastShown = shown && visibleCount <= 1;
            const prev = layout.order[i - 1];
            const next = layout.order[i + 1];
            return (
              <div
                key={key}
                className={`
                  hover:bg-accent
                  group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm
                `}
              >
                <Checkbox
                  id={`col-${key}`}
                  checked={shown}
                  disabled={isLastShown}
                  onCheckedChange={() => layout.toggleHidden(key)}
                />
                <label
                  htmlFor={`col-${key}`}
                  className={`
                    flex-1 cursor-pointer truncate
                    ${isLastShown ? "cursor-not-allowed opacity-60" : ""}
                  `}
                  title={
                    isLastShown
                      ? "A table needs at least one column"
                      : undefined
                  }
                >
                  {labels[key] ?? key}
                </label>
                {/*
                  Reorder lives here rather than as header drag-and-drop: the
                  list is the only place every column is reachable, including
                  the hidden ones, and buttons work from the keyboard.
                */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  disabled={!prev}
                  aria-label={`Move ${labels[key] ?? key} left`}
                  onClick={() => prev && layout.reorder(key, prev)}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  disabled={!next}
                  aria-label={`Move ${labels[key] ?? key} right`}
                  onClick={() => next && layout.reorder(key, next)}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-1 border-t pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={!layout.hasUserOverride}
            onClick={layout.resetToDefault}
          >
            <RotateCcw className="size-3.5" />
            Reset to default
          </Button>
          {canManageDefault ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={saving}
              onClick={() => void publishDefault()}
            >
              <Users className="size-3.5" />
              {saving ? "Saving…" : "Save as default for everyone"}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
