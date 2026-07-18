import { buildMessagesSocketNamespaceUrl } from "@manut/app-core";

import { getApiBaseUrl } from "./api-config";

/**
 * Resolve the Express `/messages` socket.io namespace URL.
 * Prefer EXPO_PUBLIC_SOCKET_URL (API origin or full namespace); otherwise derive
 * from EXPO_PUBLIC_API_URL. Relative `/api` yields same-origin `/messages`.
 */
export function getMessagesSocketUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();
  if (configured) {
    const trimmed = configured.replace(/\/+$/, "");
    if (trimmed.endsWith("/messages")) return trimmed;
    try {
      return buildMessagesSocketNamespaceUrl(trimmed);
    } catch {
      return null;
    }
  }
  try {
    return buildMessagesSocketNamespaceUrl(getApiBaseUrl());
  } catch {
    return null;
  }
}
