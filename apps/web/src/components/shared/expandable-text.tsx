"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface Props {
  text: string;
  /** Character cap for the collapsed preview. Default 200. */
  max?: number;
  className?: string;
}

/**
 * Truncates `text` to the first `max` characters with an inline
 * "Show more / Show less" toggle. Project CRM
 * lists rendered the full description in one line-clamped row, which
 * was unreadable for long entries. This wraps the same content in a
 * click-to-expand block so the preview stays compact but the full
 * body is one click away. The toggle stops propagation so the row's
 * onClick (open detail) doesn't fire while reading the body.
 */
export function ExpandableText({ text, max = 200, className }: Props) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return null;
  const needsTruncation = trimmed.length > max;
  const display =
    expanded || !needsTruncation ? trimmed : trimmed.slice(0, max);

  // Cap the expanded view's height so a 5 000-char description
  // doesn't make the table row taller than the viewport (Product CRM
  // had rows that pushed neighbouring projects off-screen). Internal
  // scroll keeps the body reachable but bounded.
  return (
    <div
      className={cn(
        "text-muted-foreground mt-0.5 text-[11px]",
        expanded && needsTruncation
          ? "max-h-48 overflow-y-auto pr-1"
          : undefined,
        className,
      )}
    >
      <p className="whitespace-pre-wrap">
        {display}
        {needsTruncation && !expanded ? "…" : null}
        {needsTruncation ? (
          <>
            {" "}
            <button
              type="button"
              className={`
                text-primary text-[11px] font-medium
                hover:underline
              `}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
