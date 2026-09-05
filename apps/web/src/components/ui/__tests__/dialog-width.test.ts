import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * `DialogContent`'s base class ends in `sm:max-w-sm` (384px).
 *
 * `cn()` is tailwind-merge, and it only dedupes classes sharing a group AND a
 * variant. A bare `max-w-2xl` on a caller does not conflict with the base's
 * `sm:max-w-sm`, so BOTH survive — and at >=640px the variant wins. The
 * caller's width is dead CSS and nothing warns.
 *
 * Observed: the tag manager asked for 2xl (672px), rendered at 384px, and put
 * its colour select and delete button behind a horizontal scrollbar.
 *
 * The fix is always the same shape: carry the `sm:` prefix so the override
 * sits in the same variant as the class it is overriding.
 */

const SRC = resolve(__dirname, "../../..");

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

describe("dialog width overrides are not silently discarded", () => {
  it("no DialogContent carries a bare max-w-*", () => {
    const offenders: string[] = [];

    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const tag of source.match(/<DialogContent[^>]*className="[^"]*"/g) ??
        []) {
        const cls = /className="([^"]*)"/.exec(tag)?.[1] ?? "";
        const bare = /(?<!:)\bmax-w-[\w[\]().%-]+/.test(cls);
        const prefixed = /sm:max-w-/.test(cls);
        if (bare && !prefixed) {
          offenders.push(`${file.replace(SRC + "/", "")}: ${cls.trim()}`);
        }
      }
    }

    expect(
      offenders,
      `these dialogs render at 384px instead of the width they ask for:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
