/**
 * Manut M3 E3.6 — bug-bash launch smoke: floating AI chat (⌘J).
 *
 * Reproduces PR #121 smoke item:
 *   "⌘J opens floating chat on /workspace/* (flag on); flag off →
 *    no anchor"
 *
 * The floating chat anchor is gated by the `floating_ai_chat` feature
 * flag (see `packages/frontend/core/src/modules/feature-flag/constant.ts:319`,
 * default `false`). The spec exercises both states by toggling the
 * flag via the in-page `FeatureFlagService` (the same surface the
 * Settings UI uses), then verifying:
 *
 *   - flag ON  → `data-testid="floating-ai-chat-anchor"` mounts,
 *                ⌘J opens the panel, Esc closes it.
 *   - flag OFF → the anchor never renders.
 *
 * Reuses the existing cloud harness — a logged-in user with one
 * workspace is enough; we don't need a doc to validate the anchor.
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
 * Flip a feature flag from inside the page via the global affine
 * services bag. The FeatureFlagService entity exposes typed Live
 * fields per flag — we walk the framework graph to reach it.
 *
 * This mirrors the production "Experimental features" toggle in
 * Settings → About; doing it via `page.evaluate` lets us drive
 * the spec without clicking through the settings dialog every
 * time.
 */
async function setFloatingChatFlag(
  page: Page,
  enabled: boolean
): Promise<void> {
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

    // The framework is reachable via the currentWorkspace bridge that
    // the test harness sets up — see `tests/kit/src/playwright.ts`'s
    // workspace fixture.
    const framework =
      globalAny.currentWorkspace?.framework ?? globalAny.__affineFramework;
    if (!framework) {
      throw new Error('framework not available — workspace not booted yet');
    }

    // Dynamic import via a runtime-computed string so TypeScript's
    // module resolver doesn't try to follow this path at compile
    // time. The path is served by the dev-server's `/packages/...`
    // proxy when Playwright drives a live web bundle. If it can't
    // resolve, we fall back to a direct localStorage flag flip,
    // which the FeatureFlagService picks up on its next read tick.
    const flagPath = '/packages/frontend/core/src/modules/feature-flag/index';
    const mod = (await import(/* @vite-ignore */ flagPath).catch(
      () => null
    )) as { FeatureFlagService?: unknown } | null;
    const FeatureFlagService = mod?.FeatureFlagService;
    if (FeatureFlagService) {
      const svc = framework.get(FeatureFlagService);
      svc.flags.floating_ai_chat.set(on);
    } else {
      // Fallback: write the flag override directly into the storage
      // key the service reads on init. The shape mirrors what the
      // Settings UI writes — see `feature-flag/entities/flags.ts`.
      window.localStorage.setItem(
        'affine-flags',
        JSON.stringify({ floating_ai_chat: on })
      );
    }
  }, enabled);
}

test.describe('@manut floating AI chat', () => {
  test.beforeEach(async ({ page }) => {
    user = await createRandomUser();
    await loginUser(page, user);
    await page.reload();
    await waitForEditorLoad(page);
    // Make sure we have at least one workspace so /workspace/{id} is
    // a valid surface — the anchor only mounts inside the workspace
    // layout (see workspace-layout.tsx).
    await createLocalWorkspace({ name: 'Manut Floating Chat' }, page);
    await enableCloudWorkspace(page);
  });

  test('floating chat > given flag off > anchor does not render', async ({
    page,
  }) => {
    // Flag defaults to false — assert the anchor is absent on a
    // workspace route. We use `count()` rather than `isVisible()` so
    // we can distinguish "hidden" from "not mounted".
    const anchor = page.getByTestId('floating-ai-chat-anchor');
    await expect(anchor).toHaveCount(0);
  });

  test('floating chat > given flag on > ⌘J opens panel, Esc closes', async ({
    page,
  }) => {
    await setFloatingChatFlag(page, true);
    // Flag flips are subscribed via LiveData — the anchor re-renders
    // on the next React frame. A short wait keeps the assertion
    // stable without polling forever.
    await page.waitForTimeout(200);

    const anchor = page.getByTestId('floating-ai-chat-anchor');
    await expect(anchor).toBeVisible({ timeout: 5_000 });

    // ⌘J opens the panel. The shortcut hook (`useFloatingChatShortcut`)
    // binds Meta+J on macOS and Ctrl+J on Windows/Linux — Playwright's
    // "Meta+J" works for both because the underlying CDP key event
    // maps to the platform-native modifier.
    await page.keyboard.press('Meta+KeyJ');

    // The panel exposes a close button as its load-bearing testid;
    // when that's visible, the slide-in completed.
    await expect(page.getByTestId('floating-ai-chat-close')).toBeVisible({
      timeout: 5_000,
    });

    // Esc collapses the panel (same hook). The anchor remains —
    // only the panel is dismissed.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('floating-ai-chat-close')).toBeHidden({
      timeout: 5_000,
    });
    await expect(anchor).toBeVisible();
  });
});
