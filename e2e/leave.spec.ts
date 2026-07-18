import { expect, test } from "@playwright/test";

test.describe("employee leave (Expo web)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leave");
    await expect(
      page.getByRole("heading", { name: "Leave", exact: true }),
    ).toBeVisible();
  });

  test("shows the seeded annual leave balance", async ({ page }) => {
    const balances = page.getByLabel("My leave balances");
    await expect(balances).toBeVisible();
    await expect(
      balances.getByText("Annual Leave", { exact: true }),
    ).toBeVisible();
    await expect(
      balances.getByText("20 / 20 days remaining", { exact: true }),
    ).toBeVisible();
  });

  test("opens the request-leave dialog", async ({ page }) => {
    await page
      .getByRole("button", { name: "Apply for leave", exact: true })
      .click();

    const dialog = page.getByRole("dialog", { name: "Request leave dialog" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Request leave", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Submit request", exact: true }),
    ).toBeVisible();
  });
});
