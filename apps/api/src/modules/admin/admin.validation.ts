import { z } from "zod";

export const updateSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});

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
