import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const profileEntitySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    code: z.string().min(1),
  })
  .strict();

export const profileRoleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

export const myProfileSchema = z
  .object({
    id: z.string().uuid(),
    email: z.email(),
    name: z.string().min(1),
    avatarUrl: nullableText,
    isActive: z.boolean(),
    mustChangePassword: z.boolean(),
    phone: nullableText,
    phonePublic: z.boolean(),
    department: nullableText,
    jobTitle: nullableText,
    employeeId: nullableText,
    employmentType: z.string().min(1),
    startDate: nullableText,
    endDate: nullableText,
    location: nullableText,
    country: nullableText,
    timezone: nullableText,
    entity: profileEntitySchema.nullable(),
    roles: z.array(profileRoleSchema),
  })
  .strict();

export const updatedMyProfileSchema = z
  .object({
    id: z.string().uuid(),
    email: z.email(),
    name: z.string().min(1),
    avatarUrl: nullableText,
    phone: nullableText,
    phonePublic: z.boolean(),
    location: nullableText,
    country: nullableText,
    timezone: nullableText,
  })
  .strict();

export const myProfileResponseSchema = z
  .object({
    data: z.object({ profile: myProfileSchema }).strict(),
  })
  .strict();

export const updatedMyProfileResponseSchema = z
  .object({ data: updatedMyProfileSchema })
  .strict();

export const updateMyProfileInputSchema = z
  .object({
    phone: z.string().trim().max(20).optional(),
    phonePublic: z.boolean().optional(),
    location: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    timezone: z.string().trim().max(100).optional(),
    avatarUrl: z.string().trim().max(2000).optional(),
  })
  .strict();

export type ProfileEntity = z.infer<typeof profileEntitySchema>;
export type ProfileRole = z.infer<typeof profileRoleSchema>;
export type MyProfile = z.infer<typeof myProfileSchema>;
export type UpdatedMyProfile = z.infer<typeof updatedMyProfileSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileInputSchema>;

export const MY_PROFILE_QUERY_KEY = ["auth", "me", "profile"] as const;

export async function getMyProfile(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<MyProfile> {
  const response = await client.get<unknown>(
    "/auth/me/profile",
    signal ? { signal } : undefined,
  );
  return myProfileResponseSchema.parse(response).data.profile;
}

export async function updateMyProfile(
  client: ApiClient,
  input: UpdateMyProfileInput,
): Promise<UpdatedMyProfile> {
  const parsedInput = updateMyProfileInputSchema.parse(input);
  const response = await client.patch<unknown>("/auth/me/profile", parsedInput);
  return updatedMyProfileResponseSchema.parse(response).data;
}
