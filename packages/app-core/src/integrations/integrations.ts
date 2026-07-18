import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const googleConnectionSchema = z
  .object({
    connected: z.boolean(),
    accountEmail: z.string().min(1).optional(),
    expiresAt: z.string().min(1).optional(),
    scope: z.string().min(1).optional(),
    canSendMail: z.boolean().optional(),
  })
  .strict();

// Project only the Google connection card for Settings; strip legacy
// gmail/drive configured flags used by product routes.
export const integrationsStatusSchema = z
  .object({
    google: googleConnectionSchema,
  })
  .transform((value) => ({ google: value.google }));

const integrationsStatusResponseSchema = z
  .object({ data: integrationsStatusSchema })
  .strict();

const oauthStartResponseSchema = z
  .object({
    data: z.object({ url: z.string().url() }).strict(),
  })
  .strict();

const disconnectResponseSchema = z
  .object({
    data: z.object({ ok: z.boolean() }).strict(),
  })
  .strict();

export type GoogleConnectionStatus = z.infer<typeof googleConnectionSchema>;
export type IntegrationsStatus = z.infer<typeof integrationsStatusSchema>;

export const INTEGRATIONS_STATUS_QUERY_KEY = ["integrations", "status"] as const;

export async function getIntegrationsStatus(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<IntegrationsStatus> {
  const response = await client.get<unknown>(
    "/integrations/status",
    signal ? { signal } : undefined,
  );
  return integrationsStatusResponseSchema.parse(response).data;
}

export async function startGoogleOauth(
  client: ApiClient,
  input: { redirect?: string } = {},
): Promise<{ url: string }> {
  const query =
    input.redirect != null && input.redirect.length > 0
      ? `?redirect=${encodeURIComponent(input.redirect)}`
      : "";
  const response = await client.get<unknown>(
    `/integrations/google/oauth-start${query}`,
  );
  return oauthStartResponseSchema.parse(response).data;
}

export async function disconnectGoogle(
  client: ApiClient,
): Promise<{ ok: boolean }> {
  const response = await client.delete<unknown>("/integrations/google");
  return disconnectResponseSchema.parse(response).data;
}

export function oauthReturnMessage(
  connected: string | null | undefined,
  errorCode: string | null | undefined,
): { tone: "success" | "error"; message: string } | null {
  if (connected === "1") {
    return { tone: "success", message: "Google account connected" };
  }
  if (!errorCode) return null;
  const messages: Record<string, string> = {
    invalid_state: "Session expired, try connecting again.",
    invalid_request: "Invalid OAuth request, try again.",
    oauth_failed: "Google rejected the request.",
    access_denied: "Access denied — you cancelled the consent screen.",
  };
  return {
    tone: "error",
    message: messages[errorCode] ?? `Google sign-in failed (${errorCode})`,
  };
}
