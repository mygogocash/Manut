/**
 * E2E coverage for the Superflow Projects (manut-pm) feature.
 *
 * Requires the backend to boot with `ENABLE_MANUT_MODULE=true`. When the
 * flag isn't set, each test detects the missing sidebar entry and skips
 * cleanly via `isSuperflowEnabled`.
 */

import { test } from '@affine-test/kit/playwright';
import { expect } from '@playwright/test';

import {
  clickSuperflowNav,
  isSuperflowEnabled,
  modalPrimaryButton,
  setupSuperflowWorkspace,
  uniqueLabel,
} from './utils/superflow';

test.describe('Superflow Projects', () => {
  test.beforeEach(async ({ page }) => {
    await setupSuperflowWorkspace(page, 'sf-projects-ws');
  });

  test('renders projects page with empty state and creates a project', async ({
    page,
  }) => {
    if (!(await isSuperflowEnabled(page))) {
      test.skip(
        true,
        'Superflow disabled — backend must boot with ENABLE_MANUT_MODULE=true.'
      );
      return;
    }

    await clickSuperflowNav(page, 'projects-nav');

    // Wait for either the page shell or skeleton to settle. Use the
    // outermost `manut-pm-page` testid the page exposes.
    await expect(page.getByTestId('manut-pm-page')).toBeVisible({
      timeout: 15_000,
    });

    // Empty state OR existing list is acceptable. Both branches lead to
    // the same "New project" CTA being reachable.
    const emptyState = page.getByTestId('manut-pm-empty');
    const existingCard = page.getByTestId('manut-pm-project-card').first();
    await expect(emptyState.or(existingCard)).toBeVisible({
      timeout: 10_000,
    });

    const projectName = uniqueLabel('E2E Project');
    await page.getByRole('button', { name: 'New project' }).first().click();

    const nameInput = page.locator('#sf-project-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(projectName);

    await modalPrimaryButton(page, 'Create project').click();

    // The newly created project should appear and auto-expand. Look it up
    // by name on a project card — the title is rendered in plain text.
    const newCard = page
      .getByTestId('manut-pm-project-card')
      .filter({ hasText: projectName });
    await expect(newCard).toBeVisible({ timeout: 10_000 });
  });

  test('expands a project card and adds a task to it', async ({ page }) => {
    if (!(await isSuperflowEnabled(page))) {
      test.skip(true, 'Superflow disabled — backend gate.');
      return;
    }

    await clickSuperflowNav(page, 'projects-nav');
    await expect(page.getByTestId('manut-pm-page')).toBeVisible({
      timeout: 15_000,
    });

    const projectName = uniqueLabel('E2E Task Project');
    await page.getByRole('button', { name: 'New project' }).first().click();
    await page.locator('#sf-project-name').fill(projectName);
    await modalPrimaryButton(page, 'Create project').click();

    const card = page
      .getByTestId('manut-pm-project-card')
      .filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 10_000 });

    // The "Add task" CTA is rendered inside the project card body after
    // expand. Newly created projects auto-expand via the page's onCreated
    // callback, so the Add task button should be reachable directly.
    const addTaskButton = card.getByRole('button', { name: 'Add task' });
    await expect(addTaskButton).toBeVisible({ timeout: 10_000 });
    await addTaskButton.click();

    const taskTitle = uniqueLabel('E2E Task');
    const titleInput = page.locator('#sf-task-title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(taskTitle);

    await modalPrimaryButton(page, 'Add task').click();

    const taskRow = page
      .getByTestId('manut-pm-task-row')
      .filter({ hasText: taskTitle });
    await expect(taskRow).toBeVisible({ timeout: 10_000 });
  });
});
