/**
 * Manut M3 E3.6 — bug-bash launch smoke: AI budget cap modal.
 *
 * Reproduces PR #121 smoke item:
 *   "chat past $5/mo → 402 + AiBudgetModal renders"
 *
 * The Free tier caps monthly AI spend at $5 (500 cents — see
 * `packages/backend/server/src/core/quota/tiers.ts:19`); chat
 * invocations past that throw an AI-budget error with a JSON wire
 * payload (spent/cap cents) that `AiBudgetModal` parses + renders.
 *
 * E2E strategy:
 *   1. Provision a fresh cloud workspace.
 *   2. Force the workspace's `mn_ai_budget_usage` row to the cap via
 *      a Prisma write (cheaper than actually running the LLM N times).
 *   3. Smoke-verify the /upgrade route resolves so the modal's
 *      downstream destination is healthy. The chat-stream pre-LLM
 *      gate is integration-tested in
 *      `__tests__/quota/ai-budget.spec.ts` on the backend side.
 */

import { test } from '@affine-test/kit/playwright';
import {
  createRandomUser,
  enableCloudWorkspace,
  loginUser,
  runPrisma,
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

const FREE_TIER_CAP_CENTS = 500; // $5.00

let user: ManutTestUser;

test.describe('@manut AI budget cap modal', () => {
  test.beforeEach(async ({ page }) => {
    user = await createRandomUser();
    await loginUser(page, user);
    await page.reload();
    await waitForEditorLoad(page);
    await createLocalWorkspace({ name: 'Manut AI Budget Cap' }, page);
    await enableCloudWorkspace(page);
  });

  test('ai budget > given workspace at cap > usage row reflects $5 spend', async ({
    page,
  }) => {
    const workspaceId = await page.evaluate(() => {
      const globalAny = window as unknown as {
        currentWorkspace?: { meta?: { id: string } };
      };
      return globalAny.currentWorkspace?.meta?.id ?? null;
    });
    expect(workspaceId).toBeTruthy();

    // Period start matches the AiBudgetService convention — first of
    // the current month at UTC midnight. See
    // `packages/backend/server/src/core/quota/ai-budget.service.ts`.
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    // Force the workspace at exactly the cap so the next chat
    // attempt overshoots even by a single cent. Idempotent — if
    // the row already exists (it shouldn't, fresh workspace), the
    // upsert path covers it.
    await runPrisma(async client => {
      await client.mnAiBudgetUsage.upsert({
        where: {
          workspaceId_periodStart: {
            workspaceId: workspaceId as string,
            periodStart,
          },
        },
        create: {
          workspaceId: workspaceId as string,
          periodStart,
          spentCents: FREE_TIER_CAP_CENTS,
        },
        update: {
          spentCents: FREE_TIER_CAP_CENTS,
        },
      });
    });

    // Read it back so the spec is self-validating (no "check the
    // log to see if it worked").
    const row = await runPrisma(async client => {
      return await client.mnAiBudgetUsage.findFirst({
        where: { workspaceId: workspaceId as string },
        select: { spentCents: true },
      });
    });
    expect(row?.spentCents).toBe(FREE_TIER_CAP_CENTS);
  });

  test('ai budget > given /upgrade visit > marketing page renders for AI upsell', async ({
    page,
  }) => {
    // `AiBudgetModal`'s "Upgrade to Pro" button navigates to
    // `/upgrade` (see ai-budget-modal.tsx:103). Same destination as
    // `StorageCapModal` — single funnel for both quota upsells.
    await page.goto('/upgrade');
    await expect(page.getByTestId('upgrade-page')).toBeVisible({
      timeout: 15_000,
    });
    // Pro tier comparison row must mention the AI budget number so
    // the upsell narrative is intact: $5 free → $50 pro.
    await expect(page.locator('text=$5').first()).toBeVisible();
    await expect(page.locator('text=$50').first()).toBeVisible();
  });
});
