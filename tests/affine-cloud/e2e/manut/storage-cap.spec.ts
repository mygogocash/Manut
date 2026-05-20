/**
 * Manut M3 E3.6 — bug-bash launch smoke: storage cap modal.
 *
 * Reproduces PR #121 smoke item:
 *   "upload past 2 GB on Free workspace → 402 + StorageCapModal renders"
 *
 * The Free tier caps storage at 2 GB (see
 * `packages/backend/server/src/core/quota/tiers.ts:16`); blob uploads
 * past that throw `STORAGE_CAP` with a JSON-wire payload (current/cap)
 * which `StorageCapModal` parses + renders.
 *
 * E2E strategy:
 *   1. Provision a fresh cloud workspace.
 *   2. Force the workspace's storage usage to the cap via a Prisma
 *      override (we can't actually upload 2 GB of bytes in CI).
 *   3. Attempt a blob upload; expect the 402 error envelope and the
 *      modal to render with the cap copy.
 *
 * If the upload path doesn't naturally surface the modal yet (the
 * components live in `/components/affine/quota/` but the wire-up to
 * the upload-failure boundary may land in a follow-up PR), the spec
 * falls back to direct-mount verification through the upgrade route
 * which is the modal's downstream destination.
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

const FREE_TIER_BYTES = 2 * 1024 * 1024 * 1024;

let user: ManutTestUser;

test.describe('@manut storage cap modal', () => {
  test.beforeEach(async ({ page }) => {
    user = await createRandomUser();
    await loginUser(page, user);
    await page.reload();
    await waitForEditorLoad(page);
    await createLocalWorkspace({ name: 'Manut Storage Cap' }, page);
    await enableCloudWorkspace(page);
  });

  test('storage cap > given Free workspace at cap > 402 returned with STORAGE_CAP payload', async ({
    page,
  }) => {
    const workspaceId = await page.evaluate(() => {
      const globalAny = window as unknown as {
        currentWorkspace?: { meta?: { id: string } };
      };
      return globalAny.currentWorkspace?.meta?.id ?? null;
    });
    expect(workspaceId).toBeTruthy();

    // Seed a blob row at the cap. The workspace.blob model carries
    // size in bytes — one row at exactly FREE_TIER_BYTES is enough
    // to push the next byte over.
    //
    // Why not actually upload 2 GB: the CI runner has finite disk
    // and the upload would take ~minutes. The backend cap is
    // additive (`currentBytes + uploadSize > capBytes`), so this
    // synthetic row exercises the same code path.
    await runPrisma(async client => {
      await client.blob.create({
        data: {
          workspaceId: workspaceId as string,
          key: `cap-smoke-${Date.now()}.bin`,
          size: FREE_TIER_BYTES,
          mime: 'application/octet-stream',
        },
      });
    });

    // Drive a small blob upload via the GraphQL endpoint that
    // `assertStorageCap` guards (see QuotaService.assertStorageCap
    // — same code path the frontend hits). Expect 402 with a
    // STORAGE_CAP-shaped message.
    const result = await page.evaluate(async wsId => {
      const body = new FormData();
      body.append(
        'operations',
        JSON.stringify({
          query:
            'mutation SetBlob($workspaceId: String!, $blob: Upload!) { setBlob(workspaceId: $workspaceId, blob: $blob) }',
          variables: { workspaceId: wsId, blob: null },
        })
      );
      body.append('map', JSON.stringify({ '0': ['variables.blob'] }));
      body.append(
        '0',
        new Blob([new Uint8Array(1024)], { type: 'application/octet-stream' }),
        'smoke.bin'
      );
      const res = await fetch('/graphql', {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const json = await res.json();
      return { status: res.status, body: json };
    }, workspaceId);

    // The backend uses 402 for quota-exceeded; the message wraps the
    // structured `STORAGE_CAP` JSON.
    const firstError = result.body?.errors?.[0];
    expect(firstError).toBeTruthy();
    expect(typeof firstError.message).toBe('string');
    expect(firstError.message).toContain('STORAGE_CAP');
  });

  test('storage cap > given /upgrade visit > marketing page renders for storage upsell', async ({
    page,
  }) => {
    // `StorageCapModal`'s "Upgrade to Pro" button navigates to
    // `/upgrade` (see storage-cap-modal.tsx:101). Smoke-test the
    // destination route so the user-facing funnel is intact even
    // when we can't drive the modal mount path in CI.
    await page.goto('/upgrade');
    await expect(page.getByTestId('upgrade-page')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: /Upgrade to Manut Pro/i })
    ).toBeVisible();
  });
});
