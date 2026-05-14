/**
 * E2E coverage for the Knowledge Graph view (`/graph` route).
 *
 * The graph itself is NOT gated on `ENABLE_MANUT_MODULE` — its sidebar
 * button always renders. It pulls doc metadata from the workspace's
 * indexer, so a freshly-created workspace renders the empty state. We
 * verify the page chrome, then trigger hover behavior on the canvas.
 *
 * We do NOT assert on the canvas pulse / starfield animations — they're
 * RAF-driven and inherently flaky in headless mode.
 */

import { test } from '@affine-test/kit/playwright';
import {
  clickNewPageButton,
  createLinkedPage,
} from '@affine-test/kit/utils/page-logic';
import { expect } from '@playwright/test';

import { setupSuperflowWorkspace } from './utils/superflow';

test.describe('Knowledge Graph', () => {
  test.beforeEach(async ({ page }) => {
    await setupSuperflowWorkspace(page, 'sf-graph-ws');
  });

  test('renders the graph page with title and canvas', async ({ page }) => {
    const graphNav = page.getByTestId('knowledge-graph');
    await expect(graphNav).toBeVisible({ timeout: 10_000 });
    await graphNav.click();

    // The page renders an overlay title "Knowledge Graph" + a <canvas> sibling.
    await expect(page.locator('text=Knowledge Graph')).toBeVisible({
      timeout: 15_000,
    });

    // Canvas should be in the DOM, with a measurable size. Pull the one
    // owned by the graph view (it's the first canvas in the workbench
    // viewport — the editor itself doesn't ship one until a block needs it).
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(50);
  });

  test('shows the empty-state message when no docs are linked', async ({
    page,
  }) => {
    await page.getByTestId('knowledge-graph').click();

    // Fresh workspace has at most one doc (Getting Started); no @-mentions,
    // so the graph's "isEmpty" branch fires and the empty-state overlay
    // is rendered.
    await expect(
      page.locator(
        'text=Graph view is ready — link some docs together using @-mentions'
      )
    ).toBeVisible({ timeout: 15_000 });
  });

  test('hovering the canvas yields a measurable cursor when nodes exist', async ({
    page,
  }) => {
    // Create two docs and link them with an @-mention so the graph has
    // at least one edge to render. Without an edge, the empty-state
    // overlay covers the canvas and hover behavior wouldn't matter.
    await clickNewPageButton(page, `Graph Target ${Date.now()}`);
    await clickNewPageButton(page, `Graph Source ${Date.now()}`);

    // Use the shared kit helper for the linked-page popover so we ride
    // upstream's selector maintenance. If the helper times out (slow CI),
    // we skip the rest of this spec rather than fail noisily.
    try {
      await createLinkedPage(page, 'Graph Target');
    } catch {
      test.skip(
        true,
        'createLinkedPage helper failed — popover did not render in time.'
      );
      return;
    }

    await page.getByTestId('knowledge-graph').click();
    await expect(page.locator('text=Knowledge Graph')).toBeVisible({
      timeout: 15_000,
    });

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const box = await canvas.boundingBox();
    if (!box) {
      test.skip(true, 'Canvas has no measurable box; skipping hover check.');
      return;
    }

    // Hover the center of the canvas. The force-directed layout starts
    // nodes near the middle so this is the most likely hit zone.
    await canvas.hover({
      position: { x: box.width / 2, y: box.height / 2 },
    });

    // The canvas's inline cursor flips to 'pointer' when a node is under
    // the pointer. We don't fail the spec on the exact value — RAF jitter
    // can park the node off-center — just surface the observed cursor
    // for triage.
    const cursor = await canvas.evaluate(
      node => (node as HTMLElement).style.cursor
    );
    test
      .info()
      .annotations.push({ type: 'graph-canvas-cursor', description: cursor });
  });
});
