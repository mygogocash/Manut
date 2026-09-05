import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Resolve a user-supplied URL to a safe, absolute href, or null when it
// isn't a clickable web/mail link. `www.` is treated as https. Anything
// that isn't http(s)/mailto (e.g. `javascript:`, `data:`) returns null so
// the caller renders it as plain text — user-submitted strings reach other
// people's browsers, so a hostile href must never become a live link.
export function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^mailto:/i.test(trimmed)) return trimmed;
  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const u = new URL(candidate);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    // not a parseable absolute URL
  }
  return null;
}

// Two regexes for one pattern: the global form drives a match loop (a fresh
// copy per call keeps `lastIndex` isolated), the non-global form is for
// stateless boolean tests — calling `.test()` on a `/g` regex mutates its
// `lastIndex` and would skip matches across calls.
export const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<]+/gi;
export const URL_TEST = /\b(?:https?:\/\/|www\.)[^\s<]+/i;

// Trailing punctuation usually belongs to the sentence, not the URL.
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

interface LinkifyProps {
  /** Plain text; bare URLs become clickable anchors. */
  text: string;
  className?: string;
}

/**
 * Render a plain string with bare http(s)/mailto URLs turned into safe
 * clickable anchors. Pure React (no `dangerouslySetInnerHTML`): text
 * segments are React-escaped and every href is gated by `safeHref`, so a
 * `javascript:`/`data:` payload stays inert text. Anchors stop click
 * propagation so a linkified cell inside a clickable row doesn't also
 * fire the row handler.
 */
export function Linkify({ text, className }: LinkifyProps) {
  const nodes: ReactNode[] = [];
  const re = new RegExp(URL_PATTERN);
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const full = m[0];
    const suffix = full.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const url = suffix ? full.slice(0, -suffix.length) : full;
    const href = safeHref(url);
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (href) {
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={`
            text-primary underline underline-offset-2
            [overflow-wrap:anywhere]
            hover:opacity-80
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>,
      );
      if (suffix) nodes.push(suffix);
    } else {
      // Not a safe link — keep the original slice as text.
      nodes.push(full);
    }
    last = m.index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <span className={cn(className)}>{nodes}</span>;
}
