/**
 * E2E coverage for the Superflow Reminders (manut-reminders) feature.
 *
 * Requires the backend to boot with `ENABLE_MANUT_MODULE=true`.
 */

import { test } from '@affine-test/kit/playwright';
import { expect } from '@playwright/test';

import {
  clickSuperflowNav,
  isSuperflowEnabled,
  setupSuperflowWorkspace,
  uniqueLabel,
} from './utils/superflow';

/**
 * Format a Date as the `YYYY-MM-DDTHH:MM` shape that
 * `<input type="datetime-local">` accepts. Mirrors the formatter
 * `defaultFireAtLocalInputValue()` in `reminders/index.tsx`.
 */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

test.describe('Superflow Reminders', () => {
  test.beforeEach(async ({ page }) => {
    await setupSuperflowWorkspace(page, 'sf-reminders-ws');
  });

  test('renders three tabs, creates a reminder, and marks it done', async ({
    page,
  }) => {
    if (!(await isSuperflowEnabled(page))) {
      test.skip(true, 'Superflow disabled — backend gate.');
      return;
    }

    await clickSuperflowNav(page, 'reminders-nav');
    await expect(page.getByTestId('reminders-page')).toBeVisible({
      timeout: 15_000,
    });

    // All three tabs visible.
    await expect(page.getByTestId('reminders-tab-due')).toBeVisible();
    await expect(page.getByTestId('reminders-tab-upcoming')).toBeVisible();
    await expect(page.getByTestId('reminders-tab-done')).toBeVisible();

    // ------------------------------------------------------------------
    // Create a reminder firing 30 minutes in the future, so it lands in
    // the "Upcoming" bucket (classifyReminder: fireAt > now -> upcoming).
    // ------------------------------------------------------------------
    const fireAt = new Date(Date.now() + 30 * 60 * 1000);
    const reminderTitle = uniqueLabel('E2E Reminder');

    await page.getByTestId('reminders-new').click();

    const titleInput = page.locator('#sf-reminder-title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(reminderTitle);

    const fireAtInput = page.locator('#sf-reminder-fire-at');
    // `Locator.fill` works on datetime-local inputs in Playwright.
    await fireAtInput.fill(toLocalInputValue(fireAt));

    await page
      .getByRole('button', { name: 'Create reminder', exact: true })
      .click();

    // Expect Upcoming tab to now contain the reminder.
    await page.getByTestId('reminders-tab-upcoming').click();
    const upcomingCard = page
      .getByTestId('reminder-card')
      .filter({ hasText: reminderTitle });
    await expect(upcomingCard).toBeVisible({ timeout: 10_000 });

    // ------------------------------------------------------------------
    // Mark done.
    // ------------------------------------------------------------------
    await upcomingCard.getByTestId('reminder-mark-done').click();

    // After the cancel mutation succeeds, the card moves to the Done tab.
    // Allow time for the GraphQL round-trip + SWR mutate.
    await page.getByTestId('reminders-tab-done').click();
    const doneCard = page
      .getByTestId('reminder-card')
      .filter({ hasText: reminderTitle });
    await expect(doneCard).toBeVisible({ timeout: 15_000 });
  });
});
