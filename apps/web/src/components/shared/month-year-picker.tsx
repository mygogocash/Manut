"use client";

import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface MonthYearPickerProps {
  /** Value in `YYYY-MM` format */
  value?: string;
  /** Called with `YYYY-MM` format */
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MonthYearPicker({
  value,
  onChange,
  placeholder = "Select month",
  disabled,
  className,
}: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => {
    if (!value) return null;
    const [ys, ms] = value.split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (Number.isNaN(y) || Number.isNaN(m)) return null;
    return { year: y, month: m };
  }, [value]);

  const [viewYear, setViewYear] = useState(
    () => parsed?.year ?? new Date().getFullYear(),
  );

  const displayLabel = useMemo(() => {
    if (!parsed) return null;
    return `${MONTHS[parsed.month - 1]} ${parsed.year}`;
  }, [parsed]);

  function selectMonth(month: number) {
    const mm = String(month).padStart(2, "0");
    onChange?.(`${viewYear}-${mm}`);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next && parsed) setViewYear(parsed.year);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start text-left text-[13px] font-normal",
            !displayLabel && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-3.5 shrink-0 opacity-50" />
          {displayLabel ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold">{viewYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((label, idx) => {
            const m = idx + 1;
            const isSelected = parsed?.year === viewYear && parsed?.month === m;
            return (
              <Button
                key={label}
                type="button"
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => selectMonth(m)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
