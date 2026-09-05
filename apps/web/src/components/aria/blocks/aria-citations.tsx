import { BookOpen } from "lucide-react";

import type { CitationsPayload } from "@/components/aria/blocks/types";

/**
 * Footnote-style citation list appended beneath ARIA replies that drew
 * on knowledge-base articles. The model is instructed to emit `[N]`
 * markers inline; this block lists what each marker refers to so the
 * reader can audit the answer.
 *
 * Knowledge articles are private (no public URL), so the entry renders
 * as a link to the in-app knowledge page filtered to the article id.
 * Clicking jumps to /aria/knowledge/{id}.
 */
export function AriaCitations({ payload }: { payload: CitationsPayload }) {
  return (
    <div
      className={`
        border-border/60 bg-background/40 mt-3 rounded-md border px-3 py-2
        text-xs
      `}
    >
      <div
        className={`
          text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px]
          font-semibold tracking-wide uppercase
        `}
      >
        <BookOpen className="size-3" />
        Sources
      </div>
      <ol className="space-y-0.5">
        {payload.citations.map((c) => (
          <li
            key={`${c.n}-${c.id}`}
            className="flex items-start gap-2 leading-snug"
          >
            <span
              className={`
                text-muted-foreground inline-block w-5 shrink-0 text-right
                tabular-nums
              `}
            >
              [{c.n}]
            </span>
            <a
              href={`/aria/knowledge/${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                text-foreground/90 truncate
                hover:text-primary hover:underline
              `}
              title={`${c.title}${c.category ? ` · ${c.category}` : ""}`}
            >
              {c.title}
              {c.category ? (
                <span className="text-muted-foreground ml-1.5 text-[10px]">
                  · {c.category}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
