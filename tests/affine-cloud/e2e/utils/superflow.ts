/**
 * Helpers for the Superflow (Projects / CRM / Reminders / Knowledge Graph)
 * end-to-end specs.
 *
 * These specs require the backend to boot with `ENABLE_MANUT_MODULE=true`
 * (legacy: `ENABLE_SUPERFLOW_MODULE=true`). The playwright config at
 * `tests/affine-cloud/playwright.config.ts` does NOT inject that env var
 * today — so when the harness runs without it, the sidebar entries are
 * absent. Each helper here is defensive: it returns a discriminated
 * `{ enabled: true | false }` result so each spec can `test.skip` cleanly
 * when the feature is gated out, rather than time out clicking an invisible
 * nav button.
 *
 * Once the harness is updated to always inject the flag (or the feature
 * graduates out of preview), drop the gate.
 */

import {
  createRandomUser,
  enableCloudWorkspace,
  loginUser,
} from '@affine-test/kit/utils/cloud';
import { waitForEditorLoad } from '@affine-test/kit/utils/page-logic';
import { createLocalWorkspace } from '@affine-test/kit/utils/workspace';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface SuperflowTestUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Sign in a fresh random user and provision a cloud workspace. Returns the
 * created user so tests that need to clean it up can do so.
 *
 * Cloud workspace is required because Superflow data is stored server-side
 * via GraphQL — local-only workspaces can't reach the manut resolvers.
 */
export async function setupSuperflowWorkspace(
  page: Page,
  workspaceName: string
): Promise<SuperflowTestUser> {
  const user = await createRandomUser();
  await loginUser(page, user);
  await page.reload();
  await waitForEditorLoad(page);
  await createLocalWorkspace({ name: workspaceName }, page);
  await enableCloudWorkspace(page);
  return user;
}

/**
 * Returns true if the Superflow sidebar entries are visible — proxy for
 * `ServerFeature.Superflow` being enabled on the backend. When false,
 * the calling spec should `test.skip` because the routes / GraphQL
 * resolvers will not be wired and any attempt to drive them would time
 * out.
 *
 * We probe the `projects-nav` testid because all three Superflow nav
 * items (`projects-nav`, `crm-nav`, `reminders-nav`) flip together —
 * they share `useSuperflowEnabled()` in root-app-sidebar.
 */
export async function isSuperflowEnabled(page: Page): Promise<boolean> {
  const probe = page.getByTestId('projects-nav');
  return probe
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
}

/**
 * Click the named Superflow sidebar entry. Expects the entry to be visible.
 */
export async function clickSuperflowNav(
  page: Page,
  testId: 'projects-nav' | 'crm-nav' | 'reminders-nav' | 'knowledge-graph'
): Promise<void> {
  const entry = page.getByTestId(testId);
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await entry.click();
}

/**
 * Generate a unique-ish identifier so the same spec can be replayed against
 * a long-lived test database without colliding with a previous run's
 * artifacts. Uses millis + a 5-digit suffix.
 */
export function uniqueLabel(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * Returns the AFFiNE-component primary action button inside a modal,
 * keyed on its visible label. Useful because modals don't reliably
 * expose a `data-testid` on the primary CTA.
 */
export function modalPrimaryButton(page: Page, label: string): Locator {
  return page.getByRole('button', { name: label, exact: true });
}
