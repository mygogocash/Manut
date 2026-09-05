import { z } from "zod";

/**
 * The settings this endpoint is allowed to write, and the type each one holds.
 *
 * Deny by default, and the reason is not hypothetical. `SystemSetting` is a
 * shared key/value table: alongside these workspace-wide toggles it also holds
 * module configuration written by dedicated, purpose-built endpoints —
 * `accounting.invoice_company` (the company bank account and SWIFT code),
 * `payslip.company`, `marketing.recap.targets`, `offboarding.template`, and every
 * notification recipient list. This route accepted `{ key: string, value:
 * unknown }`, so it could overwrite any of them with anything.
 *
 * The Settings → System tab made that reachable rather than theoretical: it read
 * EVERY row, rendered each as a text input via `String(value)`, and PUT them all
 * back on save. An object therefore round-tripped as the literal string
 * "[object Object]" — so opening that tab and pressing Save once was enough to
 * replace the company bank details with a nine-character string.
 *
 * Values are checked against the type each key actually holds, not just accepted,
 * because the same text-input round-trip turned `true` into `"true"` and `90`
 * into `"90"` — which anything reading them with `=== true` or arithmetic gets
 * silently wrong.
 *
 * Adding a genuinely workspace-wide setting means adding a line here. That is the
 * intended cost of a security boundary: a new key is inert until someone says it
 * belongs to this endpoint.
 */
export const ADMIN_SETTING_SCHEMAS = {
  "app.name": z.string().min(1).max(120),
  "app.version": z.string().min(1).max(40),
  "app.timezone": z.string().min(1).max(60),
  "app.locale": z.string().min(2).max(10),
  "leave.require_approval": z.boolean(),
  "leave.max_days_advance": z.number().int().min(0).max(3650),
  "payroll.auto_approve": z.boolean(),
  "expense.max_amount_without_approval": z.number().min(0),
  "security.session_timeout_minutes": z.number().int().min(1).max(10_080),
  "security.max_login_attempts": z.number().int().min(1).max(100),
  "notification.email_enabled": z.boolean(),
  "notification.slack_enabled": z.boolean(),
  "feature.aria_enabled": z.boolean(),
  "feature.wall_enabled": z.boolean(),
  "feature.investors_enabled": z.boolean(),
  "storage.max_file_size_mb": z.number().int().min(1).max(2048),
  "storage.allowed_extensions": z.array(z.string().min(1).max(20)).max(50),
  "company.founded_year": z.number().int().min(1800).max(2200),
  "company.headquarters": z.string().max(200),
  "company.website": z.string().max(300),
} as const;

export type AdminSettingKey = keyof typeof ADMIN_SETTING_SCHEMAS;

/** The allowlist as a plain array, for filtering reads. */
export const ADMIN_SETTING_KEYS = Object.keys(
  ADMIN_SETTING_SCHEMAS,
) as AdminSettingKey[];

export function isAdminSettingKey(key: string): key is AdminSettingKey {
  return Object.prototype.hasOwnProperty.call(ADMIN_SETTING_SCHEMAS, key);
}

export const updateSettingSchema = z
  .object({
    key: z.string().min(1).max(100),
    value: z.unknown(),
  })
  .superRefine((input, ctx) => {
    if (!isAdminSettingKey(input.key)) {
      ctx.addIssue({
        code: "custom",
        path: ["key"],
        // Names the owning route rather than just refusing, because the caller
        // that lands here is usually trying to do something legitimate.
        message: `"${input.key}" is not a setting this endpoint manages. Module configuration is written by its own endpoint.`,
      });
      return;
    }
    const parsed = ADMIN_SETTING_SCHEMAS[input.key].safeParse(input.value);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `"${input.key}" expects ${describeSettingType(input.key)}.`,
      });
    }
  });

/** Human-readable expected type, for the error a person will actually read. */
function describeSettingType(key: AdminSettingKey): string {
  const schema: unknown = ADMIN_SETTING_SCHEMAS[key];
  if (schema instanceof z.ZodBoolean) return "true or false";
  if (schema instanceof z.ZodNumber) return "a number";
  if (schema instanceof z.ZodArray) return "a list of strings";
  return "a string";
}

export const updateSettingsSchema = z.object({
  settings: z.array(updateSettingSchema).min(1),
});

export const updateModuleAccessSchema = z.object({
  userId: z.string().uuid(),
  modules: z.array(
    z.object({
      moduleId: z.string().min(1).max(50),
      granted: z.boolean(),
    }),
  ),
});

export const createUserGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export const updateUserGroupSchema = createUserGroupSchema.partial();

export const manageGroupMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "At least one user is required"),
});

// Departments CRUD — backs the new Form Configuration surface on
// `/admin/form-config`. Lets HR / admin add, rename, or deactivate
// departments without a code change, so the Employee form's
// Department dropdown is no longer driven by a hardcoded whitelist.
export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().max(20).optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
});

export const updateDepartmentSchema = createDepartmentSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UpdateModuleAccessInput = z.infer<typeof updateModuleAccessSchema>;
export type CreateUserGroupInput = z.infer<typeof createUserGroupSchema>;
export type UpdateUserGroupInput = z.infer<typeof updateUserGroupSchema>;
export type ManageGroupMembersInput = z.infer<typeof manageGroupMembersSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
