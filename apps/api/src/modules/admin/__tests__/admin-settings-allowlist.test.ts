import { describe, expect, it } from "vitest";

import {
  ADMIN_SETTING_KEYS,
  isAdminSettingKey,
  updateSettingsSchema,
} from "@/modules/admin/admin.validation";

/*
 * PUT /admin/settings took `{ key: string, value: unknown }` and wrote it
 * straight through. SystemSetting is shared, so that one endpoint could overwrite
 * any module's configuration — including `accounting.invoice_company`, which
 * holds the company bank account and SWIFT code.
 *
 * It was reachable, not theoretical: the Settings → System tab read every row,
 * rendered each through `String(value)` into a text input, and posted them all
 * back, so an object round-tripped as the literal string "[object Object]".
 */
const parse = (key: string, value: unknown) =>
  updateSettingsSchema.safeParse({ settings: [{ key, value }] });

describe("admin settings allowlist", () => {
  it("accepts the workspace-wide settings this endpoint owns", () => {
    expect(parse("app.name", "Intranet").success).toBe(true);
    expect(parse("leave.require_approval", true).success).toBe(true);
    expect(parse("security.session_timeout_minutes", 480).success).toBe(true);
    expect(parse("storage.allowed_extensions", ["pdf", "png"]).success).toBe(
      true,
    );
  });

  // The whole point: these belong to dedicated endpoints and must be unreachable.
  it.each([
    "accounting.invoice_company",
    "accounting.maker_checker",
    "payslip.company",
    "marketing.recap.targets",
    "marketing.partner_host_baselines",
    "offboarding.template",
    "onboarding.template",
    "expense.notification_recipients",
    "leave.notification_recipients",
    "visa.notification_recipients",
    "marketing.overview_content",
  ])("refuses module config key %s", (key) => {
    expect(parse(key, { anything: true }).success).toBe(false);
    expect(isAdminSettingKey(key)).toBe(false);
  });

  it("refuses a key nobody has declared, rather than creating it", () => {
    expect(parse("totally.made.up", "x").success).toBe(false);
  });

  it("names the owning route in the error, since the caller usually means well", () => {
    const result = parse("accounting.invoice_company", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/own endpoint/i);
    }
  });

  /*
   * The text-input round-trip turned `true` into `"true"` and `90` into `"90"`.
   * Anything reading those with `=== true` or arithmetic gets it silently wrong,
   * so the type is checked and not merely the key.
   */
  it("refuses a string where a boolean belongs", () => {
    expect(parse("leave.require_approval", "true").success).toBe(false);
    expect(parse("feature.aria_enabled", "false").success).toBe(false);
  });

  it("refuses a string where a number belongs", () => {
    expect(parse("security.max_login_attempts", "5").success).toBe(false);
  });

  it("refuses a comma string where a list belongs", () => {
    expect(parse("storage.allowed_extensions", "pdf,png").success).toBe(false);
  });

  it("refuses the stringified-object value the old tab produced", () => {
    expect(parse("app.name", "[object Object]").success).toBe(true); // a string key legitimately takes it
    expect(parse("leave.max_days_advance", "[object Object]").success).toBe(
      false,
    );
  });

  it("bounds the numbers it does accept", () => {
    expect(parse("security.session_timeout_minutes", 0).success).toBe(false);
    expect(parse("company.founded_year", 1700).success).toBe(false);
    expect(parse("leave.max_days_advance", -1).success).toBe(false);
  });

  it("still requires at least one setting", () => {
    expect(updateSettingsSchema.safeParse({ settings: [] }).success).toBe(
      false,
    );
  });

  // The allowlist and the seeded generic settings should not drift apart.
  it("covers every generic setting the seed creates", () => {
    for (const key of [
      "app.name",
      "app.version",
      "app.timezone",
      "app.locale",
      "leave.require_approval",
      "leave.max_days_advance",
      "payroll.auto_approve",
      "expense.max_amount_without_approval",
      "security.session_timeout_minutes",
      "security.max_login_attempts",
      "notification.email_enabled",
      "notification.slack_enabled",
      "feature.aria_enabled",
      "feature.wall_enabled",
      "feature.investors_enabled",
      "storage.max_file_size_mb",
      "storage.allowed_extensions",
      "company.founded_year",
      "company.headquarters",
      "company.website",
    ]) {
      expect(ADMIN_SETTING_KEYS).toContain(key);
    }
  });
});
