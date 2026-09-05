import { expect, test } from "@playwright/test";

// Horizontal-overflow guard.
//
// Accidental sideways scrolling is the single most common responsive defect and
// the least likely to be noticed on a desktop machine: it appears only at
// narrow widths, and it is caused by one element deep in the tree, so no code
// review catches it. This asserts the invariant directly, at every width the
// Phase 1 brief names.
//
// Scoped to routes reachable without a session. Authenticated routes need a
// storage-state fixture, which the suite does not have yet — see the Phase 1
// doc's "known limitations".

const WIDTHS = [
  320, 375, 390, 430, 768, 834, 900, 1023, 1024, 1280, 1440, 1920,
];

// Phase 10C — short viewports are measured separately because width-only
// testing missed a real defect: an investor-board column sized
// `calc(100vh - 360px)` resolved to 15px on a phone in LANDSCAPE, which no
// amount of narrow-portrait testing would have surfaced. Any rule that
// subtracts a fixed pixel count from the viewport height fails here first.
const SHORT_VIEWPORTS = [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
];

/** Routes that render fully without a session. */
const PUBLIC_ROUTES = ["/sign-in", "/forgot-password"];

for (const route of PUBLIC_ROUTES) {
  for (const width of WIDTHS) {
    test(`${route} does not scroll horizontally at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          // Name the widest offender, so a failure says what to fix rather than
          // just that something is wrong.
          widest: (() => {
            let worst = { tag: "", cls: "", right: 0 };
            for (const el of Array.from(document.body.querySelectorAll("*"))) {
              const r = el.getBoundingClientRect();
              if (r.right > worst.right) {
                worst = {
                  tag: el.tagName.toLowerCase(),
                  cls: (el.className || "").toString().slice(0, 120),
                  right: Math.round(r.right),
                };
              }
            }
            return worst;
          })(),
        };
      });

      // 1px of slack absorbs sub-pixel rounding on fractional device ratios.
      expect(
        overflow.scrollWidth,
        `widest element: <${overflow.widest.tag} class="${overflow.widest.cls}"> reaching ${overflow.widest.right}px`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
}

for (const route of PUBLIC_ROUTES) {
  for (const { width, height } of SHORT_VIEWPORTS) {
    test(`${route} fits a ${width}x${height} viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        // A viewport-height rule that has collapsed shows up as an element
        // that is present but has no usable height.
        const collapsed = Array.from(document.body.querySelectorAll("*"))
          .filter((el) => {
            const cs = getComputedStyle(el);
            if (!cs.maxHeight.endsWith("px")) return false;
            const cap = parseFloat(cs.maxHeight);
            return cap > 0 && cap < 48 && el.scrollHeight > cap + 1;
          }).length;
        return {
          overflow: doc.scrollWidth - doc.clientWidth,
          collapsed,
        };
      });

      expect(m.overflow, `${route} scrolls horizontally at ${width}x${height}`)
        .toBeLessThanOrEqual(1);
      expect(
        m.collapsed,
        `${route} has an element whose max-height collapsed below 48px at ` +
          `${width}x${height} while still holding content — the signature of a ` +
          `calc(100vh - Npx) rule on a short viewport`,
      ).toBe(0);
    });
  }
}

test("the viewport meta is emitted, so breakpoints are measured correctly", async ({
  page,
}) => {
  await page.goto("/sign-in");
  const content = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");

  // Without this tag mobile browsers assume a ~980px virtual viewport and every
  // media query in the app is evaluated against the wrong width.
  expect(content).toContain("width=device-width");
  expect(content).toContain("initial-scale=1");
  // Required for env(safe-area-inset-*) to return anything on notched devices.
  expect(content).toContain("viewport-fit=cover");
  // Pinch-zoom must stay available (WCAG 1.4.4).
  expect(content ?? "").not.toContain("user-scalable=no");
  expect(content ?? "").not.toContain("maximum-scale=1");
});
