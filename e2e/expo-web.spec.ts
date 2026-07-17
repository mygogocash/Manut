import { expect, test } from "@playwright/test";

test("Expo web renders the universal sign-in surface", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(
    page.getByRole("heading", { name: "Sign in to Manut", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
