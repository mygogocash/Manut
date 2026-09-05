import { defineConfig, devices } from "@playwright/test";

import { STORAGE_STATE } from "./e2e/storage-state";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "on",
  },
  // Until Phase 1 there was one project, Desktop Chrome, so no E2E run could
  // detect a mobile regression at all. These four cover the axes that actually
  // break: narrow width, tablet width, and a WebKit engine (iOS Safari is the
  // one browser the app has never been exercised in).
  //
  // `pnpm test:e2e --project=mobile-chrome` runs a single one.
  projects: [
    // One login, reused by every authenticated project below. Credentials come
    // from E2E_EMAIL / E2E_PASSWORD; without them this fails with a message
    // naming the variable, and nothing falls back to another account.
    // Storage state is engine-agnostic — cookies plus localStorage — so the
    // login can be performed in any browser and reused by all of them. Pinned
    // to WebKit because it is the engine this repository can currently launch;
    // change it freely once the other binaries are installed.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Safari"] },
    },

    // ── Unauthenticated ────────────────────────────────────────────────
    // Run without any credential, which is what keeps public-route and PWA
    // coverage working on a machine that has none.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /authenticated\//,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testIgnore: /authenticated\//,
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
      testIgnore: /authenticated\//,
    },
    {
      name: "tablet-safari",
      use: { ...devices["iPad Mini"] },
      testIgnore: /authenticated\//,
    },

    // ── Authenticated ──────────────────────────────────────────────────
    // Only e2e/authenticated/** runs here, and only after `setup` has produced
    // a storage state. A machine without credentials simply fails setup and
    // skips these rather than logging in as somebody it should not.
    {
      name: "authenticated-chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      testMatch: /authenticated\//,
      dependencies: ["setup"],
    },
    {
      name: "authenticated-mobile-safari",
      use: { ...devices["iPhone 13"], storageState: STORAGE_STATE },
      testMatch: /authenticated\//,
      dependencies: ["setup"],
    },
    {
      name: "authenticated-tablet-safari",
      use: { ...devices["iPad Mini"], storageState: STORAGE_STATE },
      testMatch: /authenticated\//,
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @nexora/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
