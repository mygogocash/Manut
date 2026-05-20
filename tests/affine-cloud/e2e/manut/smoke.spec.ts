/**
 * Manut M3 E3.6 — bug-bash launch smoke: full-stack health.
 *
 * The minimum we need to verify on every prod deploy:
 *   1. Server listens on the GraphQL endpoint within 10s
 *      (the boot-window CLAUDE.md §6 NestJS DI smoke calls out).
 *   2. All Wave-2 migrations from 20260520000000 →
 *      20260520040000 are applied (the five M3-blocking schema
 *      changes — embedding, AI budget, pinned doc, completed
 *      onboarding, workspace plan).
 *   3. The web frontend index.html renders and ships a React mount
 *      point (catches the bundle-stale class of bugs the CLAUDE.md
 *      "Sub-agent edits can vanish" trap warns about).
 *
 * The Playwright webServer fixture in `tests/affine-cloud/playwright.config.ts`
 * already boots the server + web bundle before the suite runs — these
 * specs assert health, they don't try to start anything themselves.
 */

import { test } from '@affine-test/kit/playwright';
import { runPrisma } from '@affine-test/kit/utils/cloud';
import { expect } from '@playwright/test';

// Migrations the Wave-2 cloud-conversion PR (#121) introduces. Every
// production deploy must run `prisma migrate deploy` and pick these up
// before any code that references them is hit (the AI-budget tables,
// pinned-doc chat histories, completedOnboarding flag, workspace
// plan column). Listed in chronological order — Prisma applies them
// in migration-name order, same as the dir listing.
const WAVE2_MIGRATIONS: ReadonlyArray<string> = [
  '20260520000000_add_mn_agent_memory_embedding',
  '20260520010000_add_mn_ai_budget_usage',
  '20260520020000_add_pinned_doc_id_to_chat_histories',
  '20260520030000_add_user_completed_onboarding',
  '20260520040000_add_workspace_plan',
];

test.describe('@manut full-stack smoke', () => {
  test('smoke > given prod-shaped boot > /graphql responds within 10s', async ({
    request,
  }) => {
    // A bare GET against /graphql returns the GraphiQL HTML in dev
    // or a 400/405 in prod depending on the introspection guard.
    // Either way, the server has to be alive to respond at all —
    // which is the only thing this assertion cares about.
    const response = await request.get('/graphql', {
      timeout: 10_000,
    });
    // The endpoint is reachable iff status is one of:
    //   200 — GraphiQL or introspection enabled
    //   400 — POST-only / malformed-request reject
    //   405 — method-not-allowed
    // Anything else (5xx, network error, timeout) means the server
    // didn't come up in time and the deploy is broken.
    expect([200, 400, 405]).toContain(response.status());
  });

  test('smoke > given test database > all Wave-2 migrations applied', async () => {
    // Prisma writes a `_prisma_migrations` row per applied migration.
    // The row carries the migration_name; we query the canonical names
    // and assert every one is present. The query runs through the
    // existing `runPrisma` helper so we reuse the test-DB connection
    // string.
    const applied = await runPrisma(async client => {
      const rows = await client.$queryRawUnsafe<
        Array<{ migration_name: string }>
      >(
        'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL'
      );
      return rows.map(r => r.migration_name);
    });

    const missing = WAVE2_MIGRATIONS.filter(name => !applied.includes(name));

    expect(
      missing,
      `Missing Wave-2 migrations: ${missing.join(', ')}. Run "yarn prisma migrate deploy" against the test DB.`
    ).toEqual([]);
  });

  test('smoke > given / > web bundle serves React mount point', async ({
    page,
  }) => {
    // Bare front-page navigation. The rspack bundle either:
    //   - mounts the React tree into `#app` (success), or
    //   - serves a Caddy SPA-fallback that returns the same HTML but
    //     never hydrates (the v1.10.x bundle-mismatch failure mode
    //     called out in CLAUDE.md §6).
    await page.goto('/', { timeout: 30_000 });

    // The root mount point must exist AND have rendered children
    // within a reasonable window. Empty `#app` after 5s is the
    // tell-tale sign of a CSS-eval crash or stale-worker bug.
    const appHandle = page.locator('#app');
    await expect(appHandle).toBeAttached({ timeout: 10_000 });

    // React has mounted iff the element has at least one child. We
    // poll for up to 10s so slow CI doesn't false-fail this.
    await expect
      .poll(
        async () => appHandle.evaluate((el: HTMLElement) => el.children.length),
        { timeout: 10_000, intervals: [200, 500, 1000] }
      )
      .toBeGreaterThan(0);
  });
});
