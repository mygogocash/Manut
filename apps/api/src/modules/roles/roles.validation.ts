import { z } from "zod";

import {
  isValidPermissionCode,
  normalizePermissionCode,
} from "@/common/constants/permissions";

const permissionCodeSchema = z
  .string()
  .transform((s) => normalizePermissionCode(s))
  .refine(isValidPermissionCode, { message: "Invalid permission code" });

const permissionsPayloadSchema = z
  .array(permissionCodeSchema)
  .min(1, "Select at least one permission")
  .transform((codes) => [...new Set(codes)]);

export const createRoleSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(500).optional(),
  permissions: permissionsPayloadSchema,
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(500).nullable().optional(),
  permissions: permissionsPayloadSchema.optional(),
  defaultRoute: z.string().max(200).nullable().optional(),
});

export const cloneRoleSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(500).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type CloneRoleInput = z.infer<typeof cloneRoleSchema>;
