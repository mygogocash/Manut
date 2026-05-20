/**
 * Manut M3 E3.6 — bug-bash launch smoke: welcome flow.
 *
 * Reproduces PR #121 smoke item:
 *   "new email → /welcome → 4-step wizard → workspace creation →
 *    /workspace/{id}/all with seeded 'Getting Started' doc"
 *
 * Reuses the existing `createRandomUser` + `loginUser` harness from
 * `@affine-test/kit/utils/cloud.ts`. The wizard is single-form +
 * four steps (workspace name, context, team, apps, project) — we
 * fill the minimum to reach `/all` and assert the seeded doc lands.
 *
 * Why this spec exists in `e2e/manut/`:
 *   - The rest of the affine-cloud suite is upstream-flavored; the
 *     `manut/` subdirectory is the launch-blocking sweep specifically
 *     called out by IMPLEMENTATION_PLAN M3 E3.6 + the PR #121 body.
 *   - Specs are tagged `@manut` in their describe block so CI can
 *     filter via `--grep @manut` if needed.
 */

import { test } from '@affine-test/kit/playwright';
import { createRandomUser, loginUser } from '@affine-test/kit/utils/cloud';
import { getPageByTitle } from '@affine-test/kit/utils/page-logic';
import { expect } from '@playwright/test';

interface ManutTestUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

let user: ManutTestUser;

test.describe('@manut welcome flow', () => {
  test.beforeEach(async ({ page }) => {
    user = await createRandomUser();
    // Sign in via the standard cloud harness — drops us at /workspace
    // if any workspace exists, else bounces to /welcome via the
    // index-router redirect (see `desktop/router.tsx`).
    await loginUser(page, user);
  });

  test('new user > given /welcome > completes wizard and lands on /all with Getting Started seeded', async ({
    page,
  }) => {
    // Fresh accounts have zero workspaces, so the index router should
    // bounce here. If a future change lands the user somewhere else,
    // navigate explicitly so the spec stays deterministic.
    await page.goto('/welcome');

    // Step 1 — workspace name. The input has a default ("X's workspace")
    // derived from the account display name; we keep it but type a
    // deterministic name on top so assertions later are stable.
    const nameInput = page.locator('#welcome-workspace-name');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    await nameInput.fill('Manut Launch Smoke');
    await page.getByRole('button', { name: 'Continue' }).first().click();

    // Step 2 — "What are you building?" — single-choice.
    await expect(
      page.getByRole('heading', { name: 'What are you building?' })
    ).toBeVisible();
    await page.getByRole('button', { name: /SaaS \/ product/i }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3 — "Who's on your team?" — single-choice (same shape).
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
    // Pick the first option, whatever it is — the wizard only needs
    // non-null so the Project plan template renders.
    const teamFirstOption = page
      .locator('button')
      .filter({ has: page.locator('span') })
      .first();
    await teamFirstOption.click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4 — "What apps do you live in?" — multi-select. Skipping
    // any apps is fine; submit moves to the project step.
    await expect(page.getByRole('heading', { name: /apps/i })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 5 — free-text project name, then Submit creates the
    // workspace and navigates to /workspace/{id}/all.
    await expect(page.getByRole('heading', { name: /project/i })).toBeVisible();
    const projectInput = page.locator('input[type="text"], textarea').first();
    await projectInput.fill('Launch readiness');

    // The submit button is labelled "Continue" on step 5 but creates
    // the workspace (see `desktop/pages/welcome/index.tsx` —
    // `handleSubmit` is the step-project `onSubmit` prop).
    await page
      .getByRole('button', { name: /Continue|Create workspace/i })
      .last()
      .click();

    // Workspace creation drops us at /workspace/{id}/all (RouteLogic.REPLACE).
    // Server-side seed inserts a "Getting Started" doc — see
    // `WorkspacesService.seedStarterDoc` in
    // `packages/backend/server/src/core/workspaces/service.ts:171`.
    await page.waitForURL(/\/workspace\/[^/]+\/all/, { timeout: 30_000 });

    // Verify the seed doc landed. `getPageByTitle` is the existing
    // helper that scopes to the all-docs list, so we don't pick up
    // stale doc-list items from a previous run.
    await expect(getPageByTitle(page, 'Getting Started')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('new user > given /welcome > Skip button creates blank workspace and seeds Getting Started', async ({
    page,
  }) => {
    await page.goto('/welcome');

    // Wait for the wizard to mount, then click Skip in the top-right.
    await expect(page.locator('#welcome-workspace-name')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Skip' }).click();

    // Skip path still creates the workspace + seeds Getting Started —
    // see `handleSkip` in `desktop/pages/welcome/index.tsx`. The
    // wizard answers are empty, so the backend skips the extras pass
    // but still emits the standard starter doc.
    await page.waitForURL(/\/workspace\/[^/]+\/all/, { timeout: 30_000 });
    await expect(getPageByTitle(page, 'Getting Started')).toBeVisible({
      timeout: 15_000,
    });
  });
});
