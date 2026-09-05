"use client";

import { useState } from "react";

import { Linkify } from "@/components/shared/linkify";
import { cn } from "@/lib/utils";

// Beyond this many characters (or any line break) an answer is clamped to a
// few lines with a Show more / Show less toggle. Char count is a cheap proxy
// for "won't fit" — it avoids a ref/measure pass and matches ExpandableText.
const LONG_THRESHOLD = 160;

/**
 * A survey response answer cell. Bounds the column width, wraps long
 * unbreakable tokens (e.g. a tracking-param URL), clamps long free-text to
 * four lines with an expand toggle, and linkifies URLs. Uses CSS line-clamp
 * rather than char truncation so a clamped URL keeps its full href and stays
 * clickable. `value` is the raw answer (string | string[] | number | null).
 */
export function AnswerCell({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);

  const text = Array.isArray(value)
    ? value.join(", ")
    : value == null
      ? ""
      : String(value);
  const trimmed = text.trim();

  if (!trimmed) return <span className="text-muted-foreground">—</span>;

  const long = trimmed.length > LONG_THRESHOLD || trimmed.includes("\n");

  return (
    <div className="max-w-[28rem]">
      <p
        className={cn(
          `
            [overflow-wrap:anywhere]
            whitespace-pre-wrap
          `,
          !expanded && long && "line-clamp-4",
          expanded && "max-h-64 overflow-y-auto pr-1",
        )}
      >
        <Linkify text={trimmed} />
      </p>
      {long && (
        <button
          type="button"
          className={`
            text-primary mt-0.5 text-[11px] font-medium
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
      )}
    </div>
  );
}
