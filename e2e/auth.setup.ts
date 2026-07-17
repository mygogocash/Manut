import { expect, test as setup } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  EMPLOYEE_STORAGE_STATE,
} from "../scripts/e2e/paths";
import { requirePersona } from "../scripts/e2e/personas";

setup.describe.configure({ mode: "serial" });

setup(
  "authenticate admin and restore the protected return path",
  async ({ page }) => {
    const admin = await requirePersona("admin");

    await page.goto("/leave?view=mine");
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/sign-in" &&
        url.searchParams.get("returnTo") === "/leave?view=mine"
      );
    });

    await page.getByLabel("Email", { exact: true }).fill(admin.email);
    await page.getByLabel("Password", { exact: true }).fill(admin.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/leave" && url.searchParams.get("view") === "mine"
      );
    });
    await expect(
      page.getByRole("heading", { name: "Leave Management", exact: true }),
    ).toBeVisible();
    await page.context().storageState({ path: ADMIN_STORAGE_STATE });
  },
);

setup("authenticate employee once", async ({ page }) => {
  const employee = await requirePersona("employee");

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(employee.email);
  await page.getByLabel("Password", { exact: true }).fill(employee.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL((url) => url.pathname === "/my-portal");
  await expect(
    page.getByRole("heading", { name: "My Portal", exact: true }),
  ).toBeVisible();
  await page.context().storageState({ path: EMPLOYEE_STORAGE_STATE });
});
