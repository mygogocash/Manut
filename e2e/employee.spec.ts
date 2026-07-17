import { expect, test } from "@playwright/test";

test("employee can navigate to Performance", async ({ page }) => {
  await page.goto("/my-portal");

  const performanceLink = page.getByRole("link", {
    name: "Performance",
    exact: true,
  });
  await expect(performanceLink).toHaveCount(1);
  await performanceLink.click();

  await expect(page).toHaveURL((url) => url.pathname === "/performance");
  // Legacy Next uses "Performance Review"; Expo foundation uses "Performance".
  await expect(
    page.getByRole("heading", {
      name: /^(Performance Review|Performance)$/,
    }),
  ).toBeVisible();
});
