import { expect, test } from "@playwright/test";

// Migrated from e2e/leave.spec.ts in Phase 7G-1.
//
// The assertions below are unchanged. What was removed is the per-test login
// that filled a hardcoded System Admin email and password — the credential
// Phase 7E reported as committed to the repository. Authentication now comes
// from the shared storage state produced by e2e/auth.setup.ts, so no spec knows
// or handles a credential.

test.describe("Leave Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leave");
    await page.waitForLoadState("networkidle");
  });

  test("should display leave page with tabs", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /leave management/i }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /my requests/i })).toBeVisible();
  });

  test("should show leave balances", async ({ page }) => {
    const balancesTab = page.getByRole("tab", { name: /balances/i });
    if (await balancesTab.isVisible()) {
      await balancesTab.click();
      await expect(page.getByText(/annual leave/i)).toBeVisible();
    }
  });

  test("should open request leave modal", async ({ page }) => {
    const requestButton = page.getByRole("button", { name: /request leave/i });
    if (await requestButton.isVisible()) {
      await requestButton.click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
  });
});
