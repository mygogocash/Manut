import { expect, test } from "@playwright/test";

test.describe("employee leave", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leave");
    await expect(
      page.getByRole("heading", { name: "Leave Management", exact: true }),
    ).toBeVisible();
  });

  test("shows the seeded annual leave balance", async ({ page }) => {
    const balances = page.getByRole("region", { name: "My leave balances" });
    await expect(balances).toBeVisible();
    await expect(
      balances.getByText("Annual Leave", { exact: true }),
    ).toBeVisible();
    await expect(
      balances.getByText("20 / 20 days", { exact: true }),
    ).toBeVisible();
  });

  test("opens the request-leave dialog", async ({ page }) => {
    await page
      .getByRole("button", { name: "Apply for Leave", exact: true })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Request Leave", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Submit", exact: true }),
    ).toBeVisible();
  });
});
