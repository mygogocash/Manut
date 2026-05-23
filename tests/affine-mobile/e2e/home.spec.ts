import { test } from '@affine-test/kit/mobile';
import { expect } from '@playwright/test';

import { expandCollapsibleSection } from './utils';

test('after loaded, will land on the home page', async ({ page }) => {
  await expect(page).toHaveURL(/.*\/home/);
});

test('mobile home menu > given home screen > then shows Notion-like top navigation', async ({
  page,
}) => {
  await expect(
    page.getByTestId('mobile-workspace-switcher-trigger')
  ).toBeVisible();

  await expect(page.getByTestId('mobile-home-menu-home')).toBeVisible();
  await expect(page.getByTestId('mobile-home-menu-chats')).toBeVisible();
  await expect(page.getByTestId('mobile-home-menu-meetings')).toBeVisible();
  await expect(page.getByTestId('mobile-home-menu-inbox')).toBeVisible();
  await expect(page.getByTestId('mobile-home-menu-home')).toHaveAttribute(
    'data-active',
    'true'
  );
});

test('recent docs', async ({ page }) => {
  const recentSection = await expandCollapsibleSection(page, 'recent');

  const docs = recentSection.getByTestId('doc-card');
  const firstDoc = docs.first();

  await expect(firstDoc).toBeVisible();

  const title = await firstDoc
    .getByTestId('doc-card-header')
    .getByRole('heading')
    .textContent();

  // when click favorite icon, will show in the favorites section
  await docs.getByRole('button', { name: 'favorite' }).first().click();

  const favList = await expandCollapsibleSection(page, 'favorites');
  await expect(favList).toBeVisible();

  if (title) {
    await expect(favList).toContainText(title);
  }
});

test('mobile home dock > given home screen when Ask AI is tapped > then opens AI composer bottom sheet instead of search', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Ask AI' }).click();

  await expect(page.getByTestId('mobile-ask-ai-panel')).toBeVisible();
  await expect(
    page.getByPlaceholder('Ask, search, or make anything...')
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/search(?:$|\?)/);
  await expect(page.getByPlaceholder('Search Docs, Collections')).toHaveCount(
    0
  );
});

test('mobile home menu > given top navigation when switching menus > then animates to Notion-like surfaces', async ({
  page,
}) => {
  await expect(page.getByTestId('mobile-home-surface-home')).toBeVisible();

  await page.getByTestId('mobile-home-menu-chats').click();
  await expect(page.getByTestId('mobile-home-menu-chats')).toHaveAttribute(
    'data-active',
    'true'
  );
  await expect(page.getByTestId('mobile-home-surface-chats')).toBeVisible();
  await expect(page.getByText('No chats yet')).toBeVisible();

  await page.getByTestId('mobile-home-menu-meetings').click();
  await expect(page.getByTestId('mobile-home-menu-meetings')).toHaveAttribute(
    'data-active',
    'true'
  );
  await expect(page.getByTestId('mobile-home-surface-meetings')).toBeVisible();
  await expect(page.getByText('New meeting note')).toBeVisible();

  await page.getByTestId('mobile-home-menu-inbox').click();
  await expect(page.getByTestId('mobile-home-menu-inbox')).toHaveAttribute(
    'data-active',
    'true'
  );
  await expect(page.getByTestId('mobile-home-surface-inbox')).toBeVisible();
});

test('mobile workspace switcher > given workspace logo is tapped > then opens Notion-like workspace menu', async ({
  page,
}) => {
  await page.getByTestId('mobile-workspace-switcher-trigger').click();

  const menu = page.getByTestId('mobile-workspace-switcher-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('header').getByText('Workspace')).toBeVisible();
  await expect(menu.getByTestId('mobile-workspace-item').first()).toBeVisible();
});

test('mobile home menu > given user switches away and returns home > then home navigation is visible', async ({
  page,
}) => {
  await page.getByTestId('mobile-home-menu-chats').click();
  await expect(page.getByTestId('mobile-home-surface-chats')).toBeVisible();

  await page.getByTestId('mobile-home-menu-home').click();
  await expect(page.getByTestId('mobile-home-menu-home')).toHaveAttribute(
    'data-active',
    'true'
  );
  await expect(page.getByTestId('mobile-home-surface-home')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Recent' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Favorites' })).toBeVisible();
});
