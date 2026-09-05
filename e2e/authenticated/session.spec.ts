import { expect, test } from "@playwright/test";

// Session behaviour, using the shared storage state.
//
// The "Dashboard after login" block from e2e/auth.spec.ts moved here in Phase
// 7G-1 with its assertions intact; its beforeEach used to log in with a
// hardcoded System Admin credential.
//
// Note the landing path is asserted loosely on purpose: a dedicated non-admin
// E2E account may hold only the Employee role, which lands on /my-portal rather
// than /dashboard.

test.describe("authenticated shell", () => {
  test("lands on an authenticated page and shows the app shell", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(dashboard|my-portal)/);
    await expect(page.locator("aside").first()).toBeVisible();
  });

  test("navigates to leave management", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /leave/i }).first().click();
    await expect(page).toHaveURL(/leave/);
  });

  test("keeps the session across a reload", async ({ page }) => {
    await page.goto("/leave");
    await page.reload();
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.locator("aside").first()).toBeVisible();
  });

  test("keeps the session across navigation between protected pages", async ({
    page,
  }) => {
    await page.goto("/leave");
    await page.goto("/projects");
    await expect(page).not.toHaveURL(/sign-in/);
  });
});
