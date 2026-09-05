"use client";

import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Which accounts a dashboard's totals count.
 *
 * A checkbox list rather than chips: the question is "is this telco in the
 * total", asked of a fixed roster of ten, so a box per account reads faster
 * than a growing row of removable tags. Built on the same Popover + Checkbox
 * pattern as `TableCustomizeMenu`, including its rule that the last remaining
 * box is locked — a total over no accounts is not a number, and the API rejects
 * an empty selection.
 */
export function AccountMultiSelect({
  accounts,
  selected,
  onToggle,
  onSelectAll,
  onSelectOnly,
}: {
  accounts: { key: string; label: string }[];
  /** `null` means every account, which is also the first-paint state. */
  selected: string[] | null;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onSelectOnly: (key: string) => void;
}) {
  const isAll = selected === null;
  const isChecked = (key: string) => isAll || selected.includes(key);
  const checkedCount = isAll ? accounts.length : selected.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-72 justify-between gap-2">
          <span className="flex items-center gap-2 truncate">
            <Users className="size-3.5 shrink-0" />
            {summarise(accounts, selected)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <p
            className={`
              text-muted-foreground text-[11px] tracking-wide uppercase
            `}
          >
            Count towards totals
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={isAll}
            onClick={onSelectAll}
          >
            All
          </Button>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto p-1">
          {accounts.map((a) => {
            const checked = isChecked(a.key);
            const isLastChecked = checked && checkedCount <= 1;
            return (
              <div
                key={a.key}
                className={`
                  hover:bg-accent
                  group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm
                `}
              >
                <Checkbox
                  id={`account-${a.key}`}
                  checked={checked}
                  disabled={isLastChecked}
                  onCheckedChange={() => onToggle(a.key)}
                />
                <label
                  htmlFor={`account-${a.key}`}
                  className={`
                    flex-1 cursor-pointer truncate
                    ${isLastChecked ? "cursor-not-allowed opacity-60" : ""}
                  `}
                  title={
                    isLastChecked
                      ? "A total needs at least one account"
                      : undefined
                  }
                >
                  {a.label}
                </label>
                {/* "Only" is the common case — looking at one telco — and takes
                    nine clicks to express with checkboxes alone. */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`
                    h-6 px-2 text-xs opacity-0
                    group-hover:opacity-100
                    focus-visible:opacity-100
                  `}
                  onClick={() => onSelectOnly(a.key)}
                >
                  Only
                </Button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Trigger text. Names the accounts while they fit, because "Dialog, GoPay" is
 * far more use at a glance than "2 of 10 accounts" — and falls back to a count
 * once naming them would overflow the button.
 */
export function summarise(
  accounts: { key: string; label: string }[],
  selected: string[] | null,
): string {
  if (selected === null) return "All accounts";
  const labels = accounts
    .filter((a) => selected.includes(a.key))
    .map((a) => a.label);
  if (labels.length === 0) return "No accounts";
  if (labels.length === accounts.length) return "All accounts";
  const named = labels.slice(0, 2).join(", ");
  return labels.length <= 2
    ? named
    : `${named} +${labels.length - 2} (${labels.length} of ${accounts.length})`;
}
