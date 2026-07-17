import { expect, test } from "@playwright/test";

test.describe("public authentication", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveTitle(/Intranet/);
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");

    await page
      .getByLabel("Email", { exact: true })
      .fill("invalid-user@example.invalid");
    await page
      .getByLabel("Password", { exact: true })
      .fill("invalid-password-placeholder");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid credentials");
  });

  test("preserves the protected deep link in the sign-in return path", async ({
    page,
  }) => {
    await page.goto("/performance?cycle=active");

    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/sign-in" &&
        url.searchParams.get("returnTo") === "/performance?cycle=active"
      );
    });
  });
});
