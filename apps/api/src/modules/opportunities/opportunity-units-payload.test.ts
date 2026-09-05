/**
 * `units` must reach the wire from EVERY read path.
 *
 * The board renders chips from `units`; the Edit dialog's per-unit table
 * writes the rows behind it. If one read path returns a row without `units`,
 * that surface silently shows a deal as Unassigned — the failure looks like
 * missing data, not like a missing mapper, which is exactly how it would
 * survive review.
 *
 * So the invariant is structural: every query that selects
 * `opportunityInclude` goes through `withUnits`. Asserted on the source text
 * rather than by calling each method, because the point is to catch a SIXTH
 * read path somebody adds later — a behavioural test can only cover the five
 * that exist today.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Just the one repository since the ARIA Revenue mirror was retired
// (2026-08-26).
const REPOSITORIES = ["opportunities/opportunities.repository.ts"];

describe.each(REPOSITORIES)("%s units payload", (relative) => {
  const source = readFileSync(join(__dirname, "..", relative), "utf8");

  /**
   * The class body split into one chunk per method.
   *
   * Per METHOD, not per line: `findMany` applies `withUnits` nine lines below
   * its `include`, past a `Promise.all` and a `count`, so a proximity window
   * flags it as unmapped. Method scope is the boundary that actually matters
   * — a query and the mapping of its result are always in the same method.
   */
  const methods = source
    .slice(source.indexOf("export class "))
    // ` {2}` not two literal spaces: eslint no-regex-spaces, and the count
    // matters — it is the class-member indent that marks a method boundary.
    .split(/\n {2}(?:async |\/\*\*)/)
    .map((body) => ({
      body,
      name: body.match(/([A-Za-z]+)\(/)?.[1] ?? "<unnamed>",
    }));

  const readPaths = methods.filter((m) =>
    m.body.includes("include: opportunityInclude"),
  );

  it("still has read paths selecting the full include", () => {
    // Guards the guard: if a refactor renames the include, every assertion
    // below would pass over an empty list and prove nothing.
    expect(readPaths.length).toBeGreaterThan(0);
  });

  it("maps every one of them through withUnits", () => {
    expect(
      readPaths.filter((m) => !m.body.includes("withUnits")).map((m) => m.name),
      `${relative}: these read paths select opportunityInclude but never call withUnits`,
    ).toEqual([]);
  });

  it("derives units from the shared helper, not a local copy", () => {
    // A second implementation is how a card and the dialog editing it come to
    // disagree about where a unit is.
    expect(source).toContain('from "@/modules/crm-shared/deal-unit-stages"');
    expect(source).toContain("dealUnitStages(");
    // Exactly one call site: inside withUnits.
    expect(source.match(/dealUnitStages\(/g)).toHaveLength(1);
  });

  it("selects the per-unit stages the helper needs", () => {
    // `dealUnitStages` reads `businessUnitProgress`; without it in the
    // include, every unit would silently fall back to the deal's stage and
    // the chips would all agree — the exact bug the chips exist to expose.
    expect(source).toContain("businessUnitProgress: {");
    expect(source).toContain("stage: true");
  });
});
