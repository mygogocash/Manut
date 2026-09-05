"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import type { ChecklistPayload } from "@/components/aria/blocks/types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Inline interactive checklist. Each item starts at the server-supplied
 * `checked` flag and toggles in local state on click — we deliberately
 * do NOT persist toggles back to the conversation today, because
 * checklist content varies per turn. If a future iteration wants to
 * remember "ARIA's last checklist had Item B ticked", that's a
 * conversation-memory job, not a chat-render job.
 */
export function AriaChecklist({ payload }: { payload: ChecklistPayload }) {
  const [state, setState] = useState<boolean[]>(() =>
    payload.items.map((item) => Boolean(item.checked)),
  );

  const completed = state.filter(Boolean).length;
  const total = state.length;

  return (
    <div
      className={`border-border/60 bg-background/60 my-2 rounded-lg border p-3`}
    >
      {payload.title ? (
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-foreground text-sm font-semibold">
            {payload.title}
          </h4>
          <span
            className={`
              text-muted-foreground inline-flex items-center gap-1 text-[11px]
              tabular-nums
            `}
          >
            <Check className="size-3" />
            {completed} / {total}
          </span>
        </div>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {payload.items.map((item, i) => {
          const checked = state[i];
          return (
            <li
              key={`${i}-${item.label}`}
              className="flex items-start gap-2 text-sm"
            >
              <Checkbox
                id={`aria-checklist-${i}`}
                checked={checked}
                onCheckedChange={(next) => {
                  setState((prev) => {
                    const copy = prev.slice();
                    copy[i] = next === true;
                    return copy;
                  });
                }}
                className="mt-0.5"
              />
              <label
                htmlFor={`aria-checklist-${i}`}
                className={cn(
                  "flex-1 cursor-pointer leading-snug",
                  checked && "text-muted-foreground line-through",
                )}
              >
                {item.label}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
