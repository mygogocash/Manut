/**
 * Proves the four Marketing Analytics mounts sit INSIDE the ship-dark gate.
 *
 * The unit tests on `isMarketingAnalyticsEnabled` prove the flag fail-closes.
 * They do not prove anything is actually gated BY it — a mount left outside
 * the `if` would keep answering with the flag off, and the flag tests would
 * still pass. That gap is the whole risk of a ship-dark flag.
 *
 * Read as source rather than by calling `registerModules`: that imports every
 * controller in the app (Prisma, email, exchange rates), so it cannot run
 * without a database. Same approach as opportunities.route-order.test.ts,
 * which this repo already relies on for a structural guarantee.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(__dirname, "..", "index.ts"), "utf8");

/** The gated family. */
const GATED_MOUNTS = [
  "/api/marketing-analytics",
  "/api/marketing-campaigns",
  "/api/marketing-recap",
  "/api/marketing-reports",
];

/** Extract the body of the `if (isMarketingAnalyticsEnabled()) { ... }` block. */
function gateBlock(): string {
  const start = SOURCE.indexOf("if (isMarketingAnalyticsEnabled())");
  expect(start).toBeGreaterThan(-1);
  const open = SOURCE.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < SOURCE.length; i += 1) {
    if (SOURCE[i] === "{") depth += 1;
    if (SOURCE[i] === "}") {
      depth -= 1;
      if (depth === 0) return SOURCE.slice(open, i + 1);
    }
  }
  throw new Error("unbalanced gate block");
}

describe("Marketing Analytics ship-dark gate", () => {
  const block = gateBlock();

  it.each(GATED_MOUNTS)("mounts %s inside the gate", (path) => {
    expect(block).toContain(`app.use("${path}"`);
  });

  it("leaves /api/marketing ungated — it is the original, shipped module", () => {
    // Gating this one would remove a module that is already live in
    // production, which is a regression rather than a ship-dark.
    expect(block).not.toContain('app.use("/api/marketing"');
    expect(SOURCE).toContain('app.use("/api/marketing", marketingRoutes)');
  });

  it("has no gated mount left outside the block", () => {
    // The failure this exists for: adding a fifth family module and mounting
    // it next to the others but outside the `if`.
    const outside = SOURCE.replace(block, "");
    for (const path of GATED_MOUNTS) {
      expect(outside).not.toContain(`app.use("${path}"`);
    }
  });

  it("gates on the flag helper, not an inline env read", () => {
    // An inline `process.env.X === "true"` would bypass the tested helper and
    // could drift from it (a different var name, or a truthy check).
    expect(SOURCE).toContain("isMarketingAnalyticsEnabled()");
    expect(SOURCE).not.toMatch(/process\.env\.MARKETING_ANALYTICS_ENABLED/);
  });
});
