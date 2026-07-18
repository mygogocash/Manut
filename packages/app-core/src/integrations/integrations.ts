import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import { ApiError } from "../api/api-error";
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

export function isGoogleNotConnectedError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 412 &&
    error.code === "GOOGLE_NOT_CONNECTED"
  );
}

const driveFileSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    size: z.union([z.string(), z.number()]).optional(),
    modifiedTime: z.string().min(1).optional(),
    modified: z.string().min(1).optional(),
    webViewLink: z.string().url().optional(),
    shared: z.boolean().optional(),
  })
  .passthrough()
  .transform((file) => ({
    id: file.id ?? null,
    name: file.name ?? "Untitled",
    mimeType: file.mimeType ?? file.type ?? null,
    size:
      file.size === undefined || file.size === null
        ? null
        : String(file.size),
    modifiedTime: file.modifiedTime ?? file.modified ?? null,
    webViewLink: file.webViewLink ?? null,
    shared: file.shared ?? null,
  }));

export const driveListParamsSchema = z
  .object({
    query: z.string().max(500).optional(),
    pageSize: z.number().int().positive().max(100).default(25),
    pageToken: z.string().min(1).optional(),
  })
  .strict();

const driveListResponseSchema = z
  .object({
    data: z.array(driveFileSchema),
    nextPageToken: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value) => ({
    data: value.data,
    nextPageToken: value.nextPageToken ?? null,
  }));

export type DriveFile = z.infer<typeof driveFileSchema>;
export type DriveListParams = z.input<typeof driveListParamsSchema>;
export type DriveList = z.infer<typeof driveListResponseSchema>;

export const DRIVE_LIST_QUERY_ROOT = ["integrations", "drive", "list"] as const;

export function driveListQueryKey(params: DriveListParams = {}) {
  return [...DRIVE_LIST_QUERY_ROOT, driveListParamsSchema.parse(params)] as const;
}

export async function listDrive(
  client: ApiClient,
  params: DriveListParams = {},
): Promise<DriveList> {
  const parsed = driveListParamsSchema.parse(params);
  const body: {
    query?: string;
    pageSize: number;
    pageToken?: string;
  } = {
    pageSize: parsed.pageSize,
  };
  if (parsed.query != null && parsed.query.length > 0) {
    body.query = parsed.query;
  }
  if (parsed.pageToken != null) {
    body.pageToken = parsed.pageToken;
  }
  const response = await client.post<unknown>("/integrations/drive/list", body);
  return driveListResponseSchema.parse(response);
}
