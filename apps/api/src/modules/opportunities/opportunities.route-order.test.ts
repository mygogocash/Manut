/**
 * Express matches routes in registration order, so a literal path declared
 * AFTER `/:id` is unreachable — `/reorder` would be swallowed and arrive as
 * `getById("reorder")`, which 404s instead of failing loudly. CLAUDE.md
 * records this as having bitten twice already.
 *
 * Read as source rather than by mounting the router: the controller pulls in
 * the whole service graph (Prisma, email, exchange rates), and the thing
 * under test here is purely the order the routes are declared in.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Just the one controller since the ARIA Revenue mirror was retired
// (2026-08-26) — kept as a list so a future sibling re-joins the sweep by
// adding a line.
const CONTROLLERS = ["opportunities/opportunities.controller.ts"];

/** Collection-level literals that must never fall behind `/:id`. */
const LITERALS = [
  "/reorder",
  "/stage-config",
  "/pipeline",
  "/forecast",
  "/filter-options",
  "/dashboard",
];

describe.each(CONTROLLERS)("%s route order", (relative) => {
  const source = readFileSync(
    join(__dirname, "..", relative.split("/").slice(-2).join("/")),
    "utf8",
  );

  const paramIndex = source.indexOf('"/:id"');

  it("declares /:id at all", () => {
    expect(paramIndex).toBeGreaterThan(-1);
  });

  it.each(LITERALS)("declares %s before /:id", (literal) => {
    const at = source.indexOf(`"${literal}"`);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(paramIndex);
  });
});

describe.each(CONTROLLERS)("%s per-unit route order", (relative) => {
  const source = readFileSync(
    join(__dirname, "..", relative.split("/").slice(-2).join("/")),
    "utf8",
  );

  it("declares GET /:id/business-units before PUT /:id/business-units/:businessUnit", () => {
    // Both are two-or-more segments so they cannot swallow /:id, but the
    // list route must precede the per-unit one: Express would otherwise
    // match "business-units" as a :businessUnit value on some verbs.
    const list = source.indexOf('"/:id/business-units"');
    const one = source.indexOf('"/:id/business-units/:businessUnit"');
    expect(list).toBeGreaterThan(-1);
    expect(one).toBeGreaterThan(-1);
    expect(list).toBeLessThan(one);
  });
});
