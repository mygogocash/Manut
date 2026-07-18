import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const SECRET_KEY_PATTERN =
  /(password|secret|api[_-]?key|token|private[_-]?key|credential)/i;

const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

function stringifySettingValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function isSecretSettingKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export const systemSettingsSchema = z
  .record(z.string(), jsonValueSchema)
  .transform((settings) => {
    const entries = Object.entries(settings)
      .filter(([key]) => !isSecretSettingKey(key))
      .map(([key, value]) => ({
        key,
        value: stringifySettingValue(value),
      }))
      .sort((left, right) => left.key.localeCompare(right.key));
    return { entries };
  });

export type SystemSettings = z.infer<typeof systemSettingsSchema>;

export const SYSTEM_SETTINGS_QUERY_KEY = ["admin", "system-settings"] as const;

const systemSettingsResponseSchema = z
  .object({
    data: z.record(z.string(), jsonValueSchema),
  })
  .strict()
  .transform(({ data }) => systemSettingsSchema.parse(data));

export async function getSystemSettings(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<SystemSettings> {
  const response = await client.get<unknown>(
    "/admin/settings",
    signal ? { signal } : undefined,
  );
  return systemSettingsResponseSchema.parse(response);
}
