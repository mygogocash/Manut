/**
 * Manut M3 E3.6 — bug-bash launch smoke: Sidebar Tabs v2.
 *
 * Reproduces PR #121 smoke item:
 *   "sidebar_tabs_v2 flag on → 5-tab strip mounts under workspace; each
 *    quick action owns the sidebar body"
 *
 * The five-icon tab strip (Home / Chat / Calendar / Inbox / Search) is
 * gated behind the `sidebar_tabs_v2` feature flag (see
 * `packages/frontend/core/src/modules/feature-flag/constant.ts:332`,
 * default `false`). Search renders an inline CMDK surface inside the
 * sidebar instead of opening the global CMDK overlay.
 */

import { test } from '@affine-test/kit/playwright';
import {
  createRandomUser,
  enableCloudWorkspace,
  loginUser,
} from '@affine-test/kit/utils/cloud';
import { waitForEditorLoad } from '@affine-test/kit/utils/page-logic';
import { createLocalWorkspace } from '@affine-test/kit/utils/workspace';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

interface ManutTestUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

let user: ManutTestUser;

/**
 * Flip the `sidebar_tabs_v2` feature flag via the in-page framework
 * graph. Mirrors the shape used in floating-chat.spec.ts — see that
 * spec's helper for the rationale on going through `page.evaluate`
 * rather than driving the Settings UI.
 */
async function setSidebarTabsFlag(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate(async on => {
    type FrameworkLike = {
      get: (svc: unknown) => {
        flags: Record<string, { set: (v: boolean) => void }>;
      };
    };
    const globalAny = window as unknown as {
      currentWorkspace?: { framework?: FrameworkLike };
      __affineFramework?: FrameworkLike;
    };
    const framework =
      globalAny.currentWorkspace?.framework ?? globalAny.__affineFramework;
    if (!framework) {
      throw new Error('framework not available — workspace not booted yet');
    }

    // Dynamic import via a runtime-computed string so TypeScript's
    // module resolver doesn't try to follow this path at compile
    // time. Same shape as `floating-chat.spec.ts` — see that spec
    // for the rationale and the localStorage fallback.
    const flagPath = '/packages/frontend/core/src/modules/feature-flag/index';
    const mod = (await import(/* @vite-ignore */ flagPath).catch(
      () => null
    )) as { FeatureFlagService?: unknown } | null;
    const FeatureFlagService = mod?.FeatureFlagService;
    if (FeatureFlagService) {
      const svc = framework.get(FeatureFlagService);
      svc.flags.sidebar_tabs_v2.set(on);
    } else {
      window.localStorage.setItem(
        'affine-flags',
        JSON.stringify({ sidebar_tabs_v2: on })
      );
    }
  }, enabled);
}

test.describe('@manut sidebar tabs v2', () => {
  test.beforeEach(async ({ page }) => {
    user = await createRandomUser();
    await loginUser(page, user);
    await page.reload();
    await waitForEditorLoad(page);
    await createLocalWorkspace({ name: 'Manut Sidebar Tabs' }, page);
    await enableCloudWorkspace(page);
  });

  test('sidebar > given flag off > tab strip absent', async ({ page }) => {
    // With the flag default-off, the legacy single-pane sidebar
    // renders and the strip never mounts. Asserting count=0 (rather
    // than hidden) catches a regression where the strip mounts but
    // is CSS-hidden — that's a different bug class we'd want to flag.
    await expect(page.getByTestId('sidebar-tab-strip')).toHaveCount(0);
  });

  test('sidebar > given flag on > 5-tab strip mounts with all icons', async ({
    page,
  }) => {
    await setSidebarTabsFlag(page, true);
    // Flag flip + LiveData re-render — see floating-chat.spec.ts for
    // the same pattern.
    await page.waitForTimeout(200);

    const strip = page.getByTestId('sidebar-tab-strip');
    await expect(strip).toBeVisible({ timeout: 5_000 });

    await expect(page.getByTestId('sidebar-workspace-section')).toBeVisible();
    const stripFollowsWorkspace = await page.evaluate(() => {
      const workspace = document.querySelector(
        '[data-testid="sidebar-workspace-section"]'
      );
      const tabStrip = document.querySelector(
        '[data-testid="sidebar-tab-strip"]'
      );
      if (!workspace || !tabStrip) {
        return false;
      }
      const position = workspace.compareDocumentPosition(tabStrip);
      return !!(position & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(stripFollowsWorkspace).toBe(true);

    // All five tabs present (testid pattern: `sidebar-tab-<id>` from
    // tab-strip.tsx:64). Use individual assertions so a failing one
    // surfaces which tab is missing.
    await expect(page.getByTestId('sidebar-tab-home')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-chat')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-meetings')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-inbox')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-search')).toBeVisible();
  });

  test('sidebar > given flag on > search opens global modal instead of sidebar body', async ({
    page,
  }) => {
    await setSidebarTabsFlag(page, true);
    await page.waitForTimeout(200);

    await page.getByTestId('sidebar-tab-chat').click();
    await expect(page.getByTestId('sidebar-chat-view')).toBeVisible({
      timeout: 5_000,
    });

    await page.getByTestId('sidebar-tab-meetings').click();
    await expect(page.getByTestId('sidebar-meetings-view')).toBeVisible({
      timeout: 5_000,
    });

    await page.getByTestId('sidebar-tab-inbox').click();
    await expect(page.getByTestId('sidebar-inbox-view')).toBeVisible({
      timeout: 5_000,
    });

    await page.getByTestId('sidebar-tab-search').click();

    await expect(page.getByTestId('cmdk-quick-search')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId('sidebar-search-view')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-tab-search')).toHaveAttribute(
      'data-active',
      'false'
    );
    const searchIsOutsideSidebar = await page.evaluate(() => {
      const search = document.querySelector(
        '[data-testid="cmdk-quick-search"]'
      );
      const sidebarSearch = document.querySelector(
        '[data-testid="sidebar-search-view"]'
      );
      return !!search && !sidebarSearch;
    });
    expect(searchIsOutsideSidebar).toBe(true);
  });
});
