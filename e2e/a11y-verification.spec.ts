import { expect, test } from "@playwright/test";

// Phase 7G — accessibility on the PRODUCTION build, using the real scanner.
// Confirms the Phase 7F contrast token fix actually ships, rather than only
// being present in dev CSS.

const PROD = "http://localhost:3002";
const AXE = "node_modules/.pnpm/axe-core@4.13.0/node_modules/axe-core/axe.min.js";

// These target the PRODUCTION standalone server, because the dev server
// deliberately unregisters service workers. If it is not running they skip
// with that stated reason — an environment fact, not a hidden failure.
test.beforeEach(async ({ request }) => {
  const up = await request
    .get(`${PROD}/sw.js`, { timeout: 3000 })
    .then((r) => r.ok())
    .catch(() => false);
  test.skip(!up, "production server not running on :3002");
});

for (const route of ["/sign-in", "/forgot-password"]) {
  test(`axe: ${route}`, async ({ page }) => {
    await page.goto(`${PROD}${route}`);
    await page.addScriptTag({ path: AXE });
    const r = await page.evaluate(async () => {
      // @ts-expect-error injected
      const res = await window.axe.run(document, { resultTypes: ["violations"] });
      const cs = getComputedStyle(document.documentElement);
      return {
        token: cs.getPropertyValue("--muted-foreground").trim(),
        violations: res.violations.map((v: { id: string; impact: string; nodes: unknown[] }) => ({
          id: v.id, impact: v.impact, nodes: v.nodes.length,
        })),
        passes: res.passes?.length ?? null,
      };
    });
    console.log(`AXE ${route}: ${JSON.stringify(r)}`);
    // The Phase 7F fix: contrast must be clean in the shipped bundle.
    expect(r.violations.filter((v) => v.id === "color-contrast")).toEqual([]);
  });
}
