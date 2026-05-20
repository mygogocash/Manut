/**
 * Manut M3 E3.6 — bug-bash launch smoke: /upgrade flow.
 *
 * Reproduces PR #121 smoke item (extends the manual test plan):
 *   "/upgrade page renders pricing + clicks Upgrade button (graceful
 *    FailedToCheckout when Stripe unconfigured)"
 *
 * The /upgrade route is the canonical destination from both
 * `StorageCapModal` and `AiBudgetModal` — single funnel for both
 * quota upsells. When `payment.manutPro.priceId` is unset (the
 * default in CI / fresh dev environments), the backend resolver
 * throws `FailedToCheckout` with a friendly message; the page
 * surfaces it in the error block rather than crashing.
 *
 * Per CLAUDE.md scar #2.5 (R0 / "graceful without STRIPE_SECRET_KEY"),
 * this graceful-degradation path is a launch blocker — verifying it
 * here keeps the prod-launch checklist green even on a fresh deploy
 * where the Stripe key hasn't been rotated in yet.
 */

import { test } from '@affine-test/kit/playwright';
import {
  createRandomUser,
  enableCloudWorkspace,
  loginUser,
} from '@affine-test/kit/utils/cloud';
import { waitForEditorLoad } from '@affine-test/kit/utils/page-logic';
import { createLocalWorkspace } from '@affine-test/kit/utils/workspace';
import { expect } from '@playwright/test';

interface ManutTestUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

let user: ManutTestUser;

test.describe('@manut /upgrade flow', () => {
  test.beforeEach(async ({ page }) => {
    user = await createRandomUser();
    await loginUser(page, user);
    await page.reload();
    await waitForEditorLoad(page);
    await createLocalWorkspace({ name: 'Manut Upgrade Flow' }, page);
    await enableCloudWorkspace(page);
  });

  test('/upgrade > given fresh visit > pricing card renders with Free vs Pro comparison', async ({
    page,
  }) => {
    await page.goto('/upgrade');

    // Top-level page card.
    await expect(page.getByTestId('upgrade-page')).toBeVisible({
      timeout: 15_000,
    });

    // Marketing copy — headline + price.
    await expect(
      page.getByRole('heading', { name: /Upgrade to Manut Pro/i })
    ).toBeVisible();
    await expect(page.locator('text=$20').first()).toBeVisible();
    await expect(page.locator('text=/per user, per month/i')).toBeVisible();

    // Feature comparison table — pull a load-bearing pair from the
    // FREE_TIER vs PRO_TIER numbers in `tiers.ts`.
    await expect(page.locator('text=2 GB')).toBeVisible();
    await expect(page.locator('text=100 GB')).toBeVisible();
    await expect(page.locator('text=$5').first()).toBeVisible();
    await expect(page.locator('text=/\\$50/').first()).toBeVisible();

    // CTA button is enabled (targetWorkspaceId resolves from the
    // workspaces fixture set up in beforeEach).
    const cta = page.getByTestId('upgrade-page-checkout-button');
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
  });

  test('/upgrade > given Stripe unconfigured > clicking Upgrade surfaces friendly error', async ({
    page,
  }) => {
    await page.goto('/upgrade');
    await expect(page.getByTestId('upgrade-page')).toBeVisible({
      timeout: 15_000,
    });

    const cta = page.getByTestId('upgrade-page-checkout-button');
    await expect(cta).toBeEnabled();
    await cta.click();

    // Two acceptable outcomes:
    //   1. Stripe is configured in the test env → the page issues a
    //      `window.location.assign(checkoutUrl)` and we leave the
    //      route. Detect by URL change away from /upgrade.
    //   2. Stripe is NOT configured (the default in CI) → the
    //      resolver throws `FailedToCheckout`; the page surfaces a
    //      friendly message via the `role="alert"` paragraph.
    //
    // Either path is launch-safe — we just need the absence of an
    // unhandled crash or blank state. Bias toward the "unconfigured"
    // branch since that's what CI sees by default.
    const alert = page.locator('[role="alert"]').first();
    const leftPage = page.waitForURL(
      url => !url.toString().includes('/upgrade'),
      {
        timeout: 10_000,
      }
    );
    const sawError = alert.waitFor({ state: 'visible', timeout: 10_000 });

    // Race: whichever happens first wins. The Promise.race surfaces
    // the first resolution; the loser is left to settle and ignored.
    await Promise.race([leftPage, sawError]);

    // If the error path won, the button should re-enable so the user
    // can retry. We don't assert here — just make sure the page
    // didn't crash.
    await expect(page.getByTestId('upgrade-page')).toBeVisible();
  });
});
