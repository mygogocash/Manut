import { expect, test as setup } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  EMPLOYEE_STORAGE_STATE,
} from "../scripts/e2e/paths";
import { requirePersona } from "../scripts/e2e/personas";

/** Next.js parity reference — admin project + legacy shell checks. */
const NEXT_WEB_ORIGIN = "http://127.0.0.1:3000";
/** Expo universal app — employee/leave cutover target. */
const EXPO_WEB_ORIGIN = "http://127.0.0.1:8081";

setup.describe.configure({ mode: "serial" });

setup(
  "authenticate admin and restore the protected return path",
  async ({ page }) => {
    const admin = await requirePersona("admin");

    await page.goto(`${NEXT_WEB_ORIGIN}/leave?view=mine`);
    await expect(page).toHaveURL((url) => {
      return (
        url.origin === NEXT_WEB_ORIGIN &&
        url.pathname === "/sign-in" &&
        url.searchParams.get("returnTo") === "/leave?view=mine"
      );
    });

    await page.getByLabel("Email", { exact: true }).fill(admin.email);
    await page.getByLabel("Password", { exact: true }).fill(admin.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL((url) => {
      return (
        url.origin === NEXT_WEB_ORIGIN &&
        url.pathname === "/leave" &&
        url.searchParams.get("view") === "mine"
      );
    });
    await expect(
      page.getByRole("heading", { name: "Leave Management", exact: true }),
    ).toBeVisible();
    await page.context().storageState({ path: ADMIN_STORAGE_STATE });
  },
);

setup("authenticate employee once on Expo web", async ({ page }) => {
  const employee = await requirePersona("employee");

  await page.goto(`${EXPO_WEB_ORIGIN}/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill(employee.email);
  await page.getByLabel("Password", { exact: true }).fill(employee.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL((url) => {
    return url.origin === EXPO_WEB_ORIGIN && url.pathname === "/my-portal";
  });
  await expect(
    page.getByRole("heading", { name: "My Portal", exact: true }),
  ).toBeVisible();
  await page.context().storageState({ path: EMPLOYEE_STORAGE_STATE });
});
