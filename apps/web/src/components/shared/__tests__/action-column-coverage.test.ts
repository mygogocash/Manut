import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Phase 8 — every action column must declare its role.
//
// `deriveMobileRoles` cannot tell an action column from a data column, so an
// un-annotated one becomes a labelled value inside the card's expander. For a
// row menu that is a nuisance; for Approve or Delete it means the control is
// simply not there. Measured on the real DataTable at 320-430px: an annotated
// action column shows 4 controls at 44px, an un-annotated one shows 0.
//
// This is a source invariant rather than a render test on purpose: the defect
// is spread across 40-odd files in 25 modules, and no single component test
// would notice a new one appearing.

const SRC = resolve(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(p, out);
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

/** The `{ key: "actions", … }` object literals in a file, with their bodies. */
function actionColumns(source: string): string[] {
  const bodies: string[] = [];
  const re = /\{\s*key:\s*["'](actions?|manage)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    for (let i = m.index; i < Math.min(source.length, m.index + 4000); i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          bodies.push(source.slice(m.index, i + 1));
          break;
        }
      }
    }
  }
  return bodies;
}

/** A column is an ACTION column only if its cell actually renders a control. */
const RENDERS_CONTROL =
  /<(Button|DropdownMenu|WorkflowActions|ResponsiveActions|IconButton|Link|a\s)/;

describe("action columns declare mobileRole", () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("components/shared/data-table")) continue;
    for (const body of actionColumns(source)) {
      if (!RENDERS_CONTROL.test(body)) continue; // a data column merely named "actions"
      checked++;
      if (!body.includes("mobileRole")) {
        offenders.push(file.slice(SRC.length + 1).replace(/\\/g, "/"));
      }
    }
  }

  it("finds the action columns it is meant to be guarding", () => {
    // Guards the guard: if the detection breaks, this fails loudly rather than
    // reporting a clean sweep over nothing.
    expect(checked).toBeGreaterThan(30);
  });

  it("has no action column that would be buried on mobile", () => {
    expect(
      offenders,
      `these render a control but do not declare mobileRole="actions", so the ` +
        `control is hidden inside the card expander on mobile:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
