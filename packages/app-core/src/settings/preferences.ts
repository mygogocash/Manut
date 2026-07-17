import { z } from "zod";

export const localPreferencesSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]).default("system"),
    language: z.enum(["en"]).default("en"),
    emailNotifications: z.boolean().default(true),
    inAppNotifications: z.boolean().default(true),
  })
  .strict();

export type LocalPreferences = z.infer<typeof localPreferencesSchema>;
export type LocalPreferencesInput = z.input<typeof localPreferencesSchema>;

export const DEFAULT_LOCAL_PREFERENCES: LocalPreferences =
  localPreferencesSchema.parse({});

export function parseLocalPreferences(value: unknown): LocalPreferences {
  const parsed = localPreferencesSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LOCAL_PREFERENCES;
}

export function mergeLocalPreferences(
  current: LocalPreferences,
  patch: Partial<LocalPreferencesInput>,
): LocalPreferences {
  return localPreferencesSchema.parse({ ...current, ...patch });
}
