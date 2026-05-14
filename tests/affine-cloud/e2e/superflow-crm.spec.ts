/**
 * E2E coverage for the Superflow CRM (manut-crm) feature.
 *
 * Requires the backend to boot with `ENABLE_MANUT_MODULE=true`.
 * Tests detect the missing sidebar entry and skip when the feature is off.
 */

import { test } from '@affine-test/kit/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import {
  clickSuperflowNav,
  isSuperflowEnabled,
  modalPrimaryButton,
  setupSuperflowWorkspace,
  uniqueLabel,
} from './utils/superflow';

/**
 * Returns the active CRM-form Modal scope. We pick the last-rendered
 * `role="dialog"` so nested "Add a stage" modals shadow the outer
 * "New deal" modal correctly.
 */
function activeModal(page: Page): Locator {
  return page.locator('[role="dialog"]').last();
}

async function fillInputByPosition(
  page: Page,
  index: number,
  value: string
): Promise<void> {
  const input = activeModal(page).locator('input').nth(index);
  await expect(input).toBeVisible();
  await input.fill(value);
}

test.describe('Superflow CRM', () => {
  test.beforeEach(async ({ page }) => {
    await setupSuperflowWorkspace(page, 'sf-crm-ws');
  });

  test('renders all four tabs and creates linked account, contact, and deal', async ({
    page,
  }) => {
    if (!(await isSuperflowEnabled(page))) {
      test.skip(true, 'Superflow disabled — backend gate.');
      return;
    }

    await clickSuperflowNav(page, 'crm-nav');
    await expect(page.getByTestId('crm-page')).toBeVisible({ timeout: 15_000 });

    // All four tab triggers should be reachable.
    for (const tabKey of ['accounts', 'contacts', 'deals', 'activities']) {
      await expect(page.getByTestId(`crm-tab-${tabKey}`)).toBeVisible();
    }

    // ------------------------------------------------------------------
    // Step 1: create an account.
    // ------------------------------------------------------------------
    await page.getByTestId('crm-tab-accounts').click();

    const accountName = uniqueLabel('E2E Acct');
    await page.getByRole('button', { name: 'New account' }).click();
    // Account modal fields: name (0), industry (1), website (2)
    await fillInputByPosition(page, 0, accountName);
    await modalPrimaryButton(page, 'Create').click();

    const accountsList = page.getByTestId('crm-accounts-list');
    await expect(accountsList).toContainText(accountName, { timeout: 10_000 });

    // ------------------------------------------------------------------
    // Step 2: create a contact linked to that account.
    // ------------------------------------------------------------------
    await page.getByTestId('crm-tab-contacts').click();

    const contactFirst = uniqueLabel('Contact');
    await page.getByRole('button', { name: 'New contact' }).click();
    // Contact modal: firstName (0), lastName (1), email (2), phone (3)
    await fillInputByPosition(page, 0, contactFirst);

    // Pick the account from the AccountPicker MenuTrigger (rendered as
    // a button by `MenuTrigger`). The menu items inside aren't part of
    // the modal `[role="dialog"]` subtree because Radix portals them
    // to the body — so we click on the page-level menu item.
    await activeModal(page).getByRole('button', { name: 'No account' }).click();
    await page.getByRole('menuitem', { name: accountName }).first().click();

    await modalPrimaryButton(page, 'Create').click();

    const contactsList = page.getByTestId('crm-contacts-list');
    await expect(contactsList).toContainText(contactFirst, { timeout: 10_000 });
    await expect(contactsList).toContainText(accountName);

    // ------------------------------------------------------------------
    // Step 3: create a deal with a fresh stage + the same account.
    // ------------------------------------------------------------------
    await page.getByTestId('crm-tab-deals').click();

    // Deals tab starts with no stages: the empty state CTA opens the
    // create-deal modal, which surfaces an inline "Add a stage" link.
    const newDealButton = page.getByRole('button', { name: 'New deal' });
    const addStageButton = page.getByRole('button', { name: 'Add a stage' });
    // Either CTA is offered depending on whether stages exist. Prefer
    // "New deal" if visible, otherwise click "Add a stage" first.
    const dealButtonVisible = await newDealButton
      .first()
      .isVisible()
      .catch(() => false);
    if (dealButtonVisible) {
      await newDealButton.first().click();
    } else {
      await addStageButton.first().click();
    }

    const dealName = uniqueLabel('E2E Deal');
    // Deal modal inputs: name (0), value (1) — pickers are buttons.
    await fillInputByPosition(page, 0, dealName);

    // Open the StagePicker. It surfaces the "Add a stage" menu item.
    // The StagePicker's MenuTrigger label is "Pick a stage" when none
    // is selected yet (en.json: com.manut.crm.fields.stage.placeholder).
    await activeModal(page)
      .getByRole('button', { name: 'Pick a stage' })
      .click();
    await page.getByRole('menuitem', { name: 'Add a stage' }).click();

    // Stage create modal is now the topmost dialog.
    const stageName = uniqueLabel('Stage');
    await fillInputByPosition(page, 0, stageName);
    await modalPrimaryButton(page, 'Create').click();

    // After the stage modal closes, focus returns to the deal modal.
    // The newly-created stage is auto-selected.
    await expect(
      activeModal(page).getByRole('button', { name: stageName })
    ).toBeVisible({ timeout: 10_000 });

    // Link account
    await activeModal(page).getByRole('button', { name: 'No account' }).click();
    await page.getByRole('menuitem', { name: accountName }).first().click();

    await modalPrimaryButton(page, 'Create').click();

    const dealsList = page.getByTestId('crm-deals-list');
    await expect(dealsList).toContainText(dealName, { timeout: 10_000 });
    await expect(dealsList).toContainText(stageName);
  });
});
