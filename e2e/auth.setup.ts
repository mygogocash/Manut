import { expect, test as setup } from "@playwright/test";

import { STORAGE_STATE } from "./storage-state";

// Authenticated Playwright setup.
//
// Runs once as its own project; every authenticated project depends on it and
// then reuses the storage state it writes, so no spec performs its own login.
//
// Credentials come from the environment and nowhere else. Nothing in this file
// prints, logs, asserts on or otherwise reveals a credential value — a failure
// here says which variable is missing, never what it contains.

/**
 * Reads a required credential.
 *
 * Fails loudly and specifically when it is absent. There is deliberately NO
 * fallback: not to a seeded account, not to an admin, not to a literal. A
 * silent fallback is how a test suite ends up authenticating as somebody it
 * should not, which is exactly the state this repository was in.
 */
function required(name: "E2E_EMAIL" | "E2E_PASSWORD"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      [
        `${name} is not set.`,
        "",
        "Authenticated E2E requires a dedicated non-admin test account.",
        "Set E2E_EMAIL and E2E_PASSWORD in your environment (or CI secrets).",
        "Never hardcode them, and never reuse an employee's own credentials.",
        "See docs/pwa/PHASE_7G1_SAFE_E2E_AUTH_SETUP.md.",
      ].join("\n"),
    );
  }
  return value;
}

setup("authenticate", async ({ page }) => {
  const email = required("E2E_EMAIL");
  const password = required("E2E_PASSWORD");

  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Where a successful login lands depends on the account:
  //   /dashboard       staff
  //   /my-portal       Employee-only roles
  //   /change-password a first login, or an account flagged mustChangePassword
  //
  // Accepting only /dashboard — as the old specs did — silently breaks for a
  // non-admin test user, which is precisely the kind of account this setup is
  // meant to use.
  await page.waitForURL(/\/(dashboard|my-portal|change-password)/, {
    timeout: 30_000,
  });

  if (new URL(page.url()).pathname.startsWith("/change-password")) {
    throw new Error(
      [
        "The E2E account is flagged mustChangePassword.",
        "",
        "Complete that once by hand, then update E2E_PASSWORD. The setup will",
        "not change it: rotating a password from a test fixture would leave the",
        "credential in a place nobody expects it.",
      ].join("\n"),
    );
  }

  // Prove the session is real rather than trusting the URL. A redirect can be
  // in flight, and an unauthenticated shell can render at the same path.
  await expect(
    page.getByRole("button", { name: /account|profile|menu/i }).or(
      page.locator("aside").first(),
    ),
  ).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
