import { expect, test } from "@playwright/test";

// Public sign-in behaviour only.
//
// Phase 7G-1 removed the two credential-bearing tests from this file: they
// filled a hardcoded System Admin email and password, so simply running
// `pnpm test:e2e` attempted a login with the credential Phase 7E reported as
// committed. Their coverage now lives in e2e/authenticated/session.spec.ts,
// which authenticates from environment-supplied credentials via storage state.
//
// The invalid-credentials test below stays: its inputs are deliberately fake.

test.describe("Authentication", () => {
  test("should display login page correctly", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveTitle(/Intranet/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel(/email/i).fill("wrong@email.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for error message to appear (Supabase returns "Invalid login credentials")
    await expect(
      page.getByText(/invalid|error|fail|credentials|incorrect/i),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("should redirect unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });
});
