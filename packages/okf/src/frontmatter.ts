import { parse as parseYaml } from "yaml";

const DELIMITER = "---";

export interface ParsedDocument {
  frontmatter: Record<string, unknown> | null;
  body: string;
}

/**
 * Split an OKF markdown document into its YAML frontmatter block and body.
 *
 * A frontmatter block exists only when the document opens with `---` on its
 * own first line. A `---` anywhere else is a horizontal rule (docs/ is full
 * of them) and must not be mistaken for frontmatter.
 */
export function parseFrontmatter(source: string): ParsedDocument {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith(`${DELIMITER}\n`)) {
    return { frontmatter: null, body: normalized };
  }

  const closingIndex = normalized.indexOf(`\n${DELIMITER}`, DELIMITER.length);
  if (closingIndex === -1) {
    return { frontmatter: null, body: normalized };
  }

  const raw = normalized.slice(DELIMITER.length + 1, closingIndex);
  const body = normalized.slice(closingIndex + DELIMITER.length + 1).replace(/^\n/, "");

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Malformed YAML frontmatter: ${message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Malformed YAML frontmatter: expected a mapping of keys to values");
  }

  return { frontmatter: parsed as Record<string, unknown>, body };
}
