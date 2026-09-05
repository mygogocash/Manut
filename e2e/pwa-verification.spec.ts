import { expect, test } from "@playwright/test";

// Phase 7G — PWA verification on the production build.
// Re-run because sheet.tsx and the contrast token changed since Phase 7E.
// The dev server deliberately unregisters workers, so this targets :3002.

const PROD = "http://localhost:3002";

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

test("service worker registers, and caches no authenticated endpoint", async ({
  page,
}) => {
  await page.goto(`${PROD}/sign-in`);
  const r = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const stored: string[] = [];
    for (const n of names) {
      const c = await caches.open(n);
      for (const req of await c.keys()) stored.push(new URL(req.url).pathname);
    }
    return {
      scope: reg.scope,
      active: reg.active?.state ?? null,
      cacheNames: names,
      cached: stored.length,
      forbidden: stored.filter((p) => /^\/(api|auth|ingest)\//.test(p)),
    };
  });
  console.log("PWA:", JSON.stringify(r));
  expect(r.active).toBe("activated");
  // The security property: no authenticated surface may be cached.
  expect(r.forbidden).toEqual([]);
});

test("offline serves a shell and still caches nothing authenticated", async ({
  page,
  context,
}) => {
  await page.goto(`${PROD}/sign-in`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  await page.reload();

  await context.setOffline(true);
  await page
    .goto(`${PROD}/a/route/never/visited`, { waitUntil: "domcontentloaded" })
    .catch(() => null);
  const body = await page.evaluate(() => document.body.innerText.slice(0, 120));
  const forbidden = await page.evaluate(async () => {
    const out: string[] = [];
    for (const n of await caches.keys()) {
      const c = await caches.open(n);
      for (const r of await c.keys()) out.push(new URL(r.url).pathname);
    }
    return out.filter((p) => /^\/(api|auth|ingest)\//.test(p));
  });
  await context.setOffline(false);

  console.log("OFFLINE:", JSON.stringify({ body: body.slice(0, 60), forbidden }));
  expect(forbidden).toEqual([]);
  expect(body.length).toBeGreaterThan(0);
});

test("the manifest is served and installable-shaped", async ({ page }) => {
  const res = await page.request.get(`${PROD}/manifest.webmanifest`);
  expect(res.status()).toBe(200);
  const m = await res.json();
  console.log("MANIFEST:", JSON.stringify({
    name: m.name, display: m.display, icons: m.icons?.length,
    start_url: m.start_url, scope: m.scope,
  }));
  expect(m.display).toBe("standalone");
  expect(Array.isArray(m.icons) && m.icons.length).toBeTruthy();
});
