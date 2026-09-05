/**
 * Markdown post-processor for assistant replies.
 *
 * Anthropic occasionally emits markdown markers (`##`, `-`, `1.`)
 * stuck to the previous sentence with no surrounding newlines —
 * especially during streaming, where deltas arrive a few tokens at a
 * time. `react-markdown` requires those markers at line start, so a
 * raw "...partner relationships.## Executive Summary" renders as
 * literal text instead of a heading.
 *
 * This function normalises the buffer on every render. It is
 * idempotent: re-running on an already-normalised string is a no-op,
 * so applying it on every stream tick is safe.
 *
 * Scope: headings (#…######), unordered list bullets (`- `, `* `,
 * `+ `), and ordered list markers (`1. ` etc.) that follow non-
 * whitespace.
 */
export function normalizeAssistantMarkdown(content: string): string {
  if (!content) return content;
  let out = content;

  // Heading marker glued to text → "text.## Heading" becomes
  // "text.\n\n## Heading". The preceding-char class explicitly
  // excludes `#` (otherwise we'd shred a valid `##` into `#\n\n# `)
  // and any whitespace (already correct).
  out = out.replace(/([^\s\n#])(#{1,6}\s)/g, "$1\n\n$2");

  // Heading on a line with no blank line above (`text\n## Heading`).
  // Promote the single newline to two for the markdown parser.
  out = out.replace(/([^\n#])\n(#{1,6}\s)/g, "$1\n\n$2");

  // Unordered list bullets glued to text. Only catches the most
  // common case — a `.`, `:`, `;`, `,`, or alphanumeric followed by
  // `- ` / `* ` / `+ `. We deliberately don't match `*` adjacent to
  // letters because that's emphasis.
  out = out.replace(/([.:;,A-Za-z0-9])(-\s)/g, "$1\n$2");

  // Numbered list marker glued to text — "text.1. First item".
  out = out.replace(/([.:;,A-Za-z])(\d+\.\s)/g, "$1\n$2");

  return out;
}
