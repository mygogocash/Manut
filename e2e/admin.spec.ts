import { expect, test } from "@playwright/test";

test("admin dashboard exposes working sidebar navigation", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  const leaveLink = page.getByRole("link", { name: "Leave", exact: true });
  await expect(leaveLink).toHaveCount(1);
  await leaveLink.click();

  await expect(page).toHaveURL((url) => url.pathname === "/leave");
  await expect(
    page.getByRole("heading", { name: "Leave Management", exact: true }),
  ).toBeVisible();
});
