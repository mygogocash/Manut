import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { BUNDLE_ROOT, readDocument, REPO_ROOT } from "./bundle";
import { COVERAGE_MANIFEST } from "./coverage-manifest";

const SECTIONS = ["## Common pitfalls", "## Module-specific patterns to reuse"];

/**
 * Minimum body length (in trimmed characters, frontmatter excluded) a real
 * concept document must clear.
 *
 * Measured across the 28 manifest documents on 2026-08-17, the shortest real
 * body is 198 chars (`pitfalls/system-admin-role.md`). 150 sits comfortably
 * below that — enough headroom that trimming a sentence during normal
 * editing won't trip it — while still far exceeding what gutting leaves
 * behind: a frontmatter-only file has a 0-char body, and frontmatter plus a
 * bare `#` heading (the reviewer's `soft-delete-restore.md` reproduction)
 * leaves on the order of 50-70 chars.
 */
const BODY_LENGTH_FLOOR = 150;

/** Section-specific headings a concept document's body must carry. */
const REQUIRED_HEADINGS: Record<string, { all?: string[]; anyOf?: string[] }> =
  {
    pitfalls: { all: ["## Rule", "## Why"] },
    // 5 of 28 documents lack "## Reference" today — it is intentionally not required.
    patterns: { anyOf: ["## Shape", "## Steps"] },
  };

/**
 * Bold labels of the `- **…**` bullets found within each of `SECTIONS`, scanning from the
 * heading line up to (but not including) the next `## ` heading.
 *
 * Throws if a heading in `SECTIONS` is not found as a literal line in `source` — a missing
 * heading must fail loudly, not silently contribute zero labels for that section (which would
 * let the coverage gate pass while having checked nothing).
 */
export function extractBulletLabels(source: string): string[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const labels: string[] = [];

  for (const heading of SECTIONS) {
    const start = lines.indexOf(heading);
    if (start === -1) {
      throw new Error(
        `extractBulletLabels: heading not found in source: ${JSON.stringify(heading)}`,
      );
    }
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (line.startsWith("## ")) break;
      const match = /^- \*\*(.+?)\*\*/.exec(line);
      if (match) labels.push(match[1]!);
    }
  }
  return labels;
}

/** Bold labels of the `- **…**` bullets in CLAUDE.md's two knowledge sections. */
function extractClaudeMdBullets(): string[] {
  const source = fs.readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
  return extractBulletLabels(source);
}

describe("CLAUDE.md knowledge coverage", () => {
  // A tripwire against accidental drift, deliberately bumped when the manifest
  // grows. 28 at the 2026-08-17 freeze; 30 after main claimed the two
  // business-unit bullets (#1117 -> #1125); 34 after this release added the four
  // remaining bullets dev had accumulated (dev has never carried packages/okf,
  // so nothing claimed them until the branches met); 35 after the ARIA
  // Revenue retirement's parked-tables pitfall (#1164); 38 after the IT
  // Billing monthly spend series (#1186); 39 after the Office purchase-log
  // import pattern (#1187).
  it("the manifest holds exactly 39 entries", () => {
    expect(COVERAGE_MANIFEST).toHaveLength(39);
  });

  it("every manifest entry maps to exactly one existing concept file", () => {
    const missing: string[] = [];
    for (const entry of COVERAGE_MANIFEST) {
      const resolved = path.join(BUNDLE_ROOT, entry.conceptFile);
      if (!fs.existsSync(resolved)) missing.push(entry.conceptFile);
    }
    expect(missing).toEqual([]);
  });

  it("no two manifest entries point at the same concept file", () => {
    const files = COVERAGE_MANIFEST.map((e) => e.conceptFile);
    expect(new Set(files).size).toBe(files.length);
  });

  it("every knowledge bullet currently in CLAUDE.md is claimed by the manifest", () => {
    const claimed = COVERAGE_MANIFEST.map((e) => e.bullet);
    const unclaimed = extractClaudeMdBullets().filter(
      (label) => !claimed.some((bullet) => label === bullet),
    );
    expect(unclaimed).toEqual([]);
  });

  it("every concept document under patterns/ and pitfalls/ is claimed by the manifest", () => {
    const claimed = new Set(COVERAGE_MANIFEST.map((e) => e.conceptFile));
    const orphans: string[] = [];
    for (const dir of ["pitfalls", "patterns"]) {
      for (const name of fs.readdirSync(path.join(BUNDLE_ROOT, dir))) {
        if (!name.endsWith(".md") || name === "index.md") continue;
        const rel = `${dir}/${name}`;
        if (!claimed.has(rel)) orphans.push(rel);
      }
    }
    expect(orphans).toEqual([]);
  });

  it("every manifest marker appears verbatim in its mapped concept file's body", () => {
    const failures: string[] = [];
    for (const entry of COVERAGE_MANIFEST) {
      const resolved = path.join(BUNDLE_ROOT, entry.conceptFile);
      if (!fs.existsSync(resolved)) continue; // already reported by the file-existence assertion
      const { body } = readDocument(resolved);
      for (const marker of entry.markers) {
        if (!body.includes(marker)) {
          failures.push(
            `${entry.conceptFile} → missing marker ${JSON.stringify(marker)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("every concept document's body clears the gutting floor", () => {
    const failures: string[] = [];
    for (const entry of COVERAGE_MANIFEST) {
      const resolved = path.join(BUNDLE_ROOT, entry.conceptFile);
      if (!fs.existsSync(resolved)) continue;
      const { body } = readDocument(resolved);
      const length = body.trim().length;
      if (length <= BODY_LENGTH_FLOOR) {
        failures.push(
          `${entry.conceptFile} → body is ${length} chars, floor is ${BODY_LENGTH_FLOOR}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it("every concept document carries its section's required headings", () => {
    const failures: string[] = [];
    for (const entry of COVERAGE_MANIFEST) {
      const resolved = path.join(BUNDLE_ROOT, entry.conceptFile);
      if (!fs.existsSync(resolved)) continue;
      const { body } = readDocument(resolved);
      const section = entry.conceptFile.split("/")[0]!;
      const required = REQUIRED_HEADINGS[section];
      if (!required) continue;
      for (const heading of required.all ?? []) {
        if (!body.includes(heading)) {
          failures.push(
            `${entry.conceptFile} → missing required heading ${heading}`,
          );
        }
      }
      if (
        required.anyOf &&
        !required.anyOf.some((heading) => body.includes(heading))
      ) {
        failures.push(
          `${entry.conceptFile} → missing one of required headings ${required.anyOf.join(" or ")}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("extractBulletLabels", () => {
  it("returns the bold labels found within each scanned section", () => {
    const source = [
      "# Title",
      "",
      "## Common pitfalls",
      "",
      "- **Foo**: bar baz.",
      "- **Quux**: corge.",
      "",
      "---",
      "",
      "## Module-specific patterns to reuse",
      "",
      "- **Widget**: gadget.",
      "",
      "## When in doubt",
      "",
      "- Not a bold bullet, should not be picked up.",
    ].join("\n");

    expect(extractBulletLabels(source)).toEqual(["Foo", "Quux", "Widget"]);
  });

  it("throws naming the heading when '## Common pitfalls' is missing", () => {
    const source = [
      "# Title",
      "",
      "## Module-specific patterns to reuse",
      "",
      "- **Widget**: gadget.",
    ].join("\n");

    expect(() => extractBulletLabels(source)).toThrow(/## Common pitfalls/);
  });

  it("throws naming the heading when '## Module-specific patterns to reuse' is missing", () => {
    const source = [
      "# Title",
      "",
      "## Common pitfalls",
      "",
      "- **Foo**: bar baz.",
    ].join("\n");

    expect(() => extractBulletLabels(source)).toThrow(
      /## Module-specific patterns to reuse/,
    );
  });
});
