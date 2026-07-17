"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Matcher } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parse `YYYY-MM-DD` as local calendar date; invalid input returns undefined. */
export function parseYmdLocal(ymd: string | undefined): Date | undefined {
  if (!ymd?.trim()) return undefined;
  const s = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const m = Number(ms) - 1;
  const d = Number(ds);
  const dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) {
    return undefined;
  }
  return dt;
}

interface FormDatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Inclusive lower bound (`YYYY-MM-DD`): days before this are not selectable. */
  minDate?: string;
  /** Inclusive upper bound (`YYYY-MM-DD`): days after this are not selectable. */
  maxDate?: string;
  /**
   * Show an inline ✕ to wipe the date back to blank. Defaults to true so
   * any caller picks up the affordance automatically; optional go-live
   * fields must be clearable.
   * Pass `false` for required fields where empty is invalid.
   */
  clearable?: boolean;
}

export function FormDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  minDate,
  maxDate,
  clearable = true,
}: FormDatePickerProps) {
  const [open, setOpen] = useState(false);

  const calendarDisabled = useMemo((): Matcher | Matcher[] | undefined => {
    const minD = parseYmdLocal(minDate);
    const maxD = parseYmdLocal(maxDate);
    const matchers: Matcher[] = [];
    if (minD) matchers.push({ before: minD });
    if (maxD) matchers.push({ after: maxD });
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  // DayPicker v9 caps the year-dropdown range at the explicit
  // start / end month props. Without these, the dropdown only spans
  // ~10 years around the current year and HR can't pick start dates
  // for older or future-dated employment records. Honour any
  // caller-provided min/max bounds first; otherwise default to a wide
  // range so the picker is usable for visa expiries, retirements, etc.
  const navBounds = useMemo(() => {
    const minD = parseYmdLocal(minDate);
    const maxD = parseYmdLocal(maxDate);
    const now = new Date();
    return {
      startMonth: minD ?? new Date(now.getFullYear() - 100, 0, 1),
      endMonth: maxD ?? new Date(now.getFullYear() + 50, 11, 31),
    };
  }, [minDate, maxDate]);

  function parseDate(v: string | undefined): Date | undefined {
    return parseYmdLocal(v);
  }

  const selected = parseDate(value);

  const showClear = clearable && !disabled && !!selected;

  function handleClear(e: React.MouseEvent) {
    // Stop the click from bubbling into the PopoverTrigger button —
    // otherwise clearing also opens the calendar.
    e.preventDefault();
    e.stopPropagation();
    onChange?.("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start text-left text-[13px] font-normal",
              !selected && "text-muted-foreground",
              showClear && "pr-8",
              className,
            )}
          >
            <CalendarIcon className="mr-2 size-3.5 opacity-50" />
            {selected ? format(selected, "dd-MM-yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        {showClear ? (
          <button
            type="button"
            aria-label="Clear date"
            onClick={handleClear}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              `
                text-muted-foreground absolute top-1/2 right-1.5 flex size-6
                -translate-y-1/2 items-center justify-center rounded-md
                hover:bg-muted hover:text-foreground
              `,
            )}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          disabled={calendarDisabled}
          captionLayout="dropdown"
          startMonth={navBounds.startMonth}
          endMonth={navBounds.endMonth}
          onSelect={(date) => {
            if (date) {
              const yyyy = date.getFullYear();
              const mm = String(date.getMonth() + 1).padStart(2, "0");
              const dd = String(date.getDate()).padStart(2, "0");
              onChange?.(`${yyyy}-${mm}-${dd}`);
            } else {
              onChange?.("");
            }
            setOpen(false);
          }}
          defaultMonth={selected}
        />
        {clearable && !disabled && selected ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`text-muted-foreground w-full justify-center text-xs`}
              onClick={() => {
                onChange?.("");
                setOpen(false);
              }}
            >
              <X className="mr-1 size-3.5" />
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
