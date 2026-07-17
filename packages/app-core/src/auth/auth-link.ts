import type { AuthLinkTokens } from "./auth-types";

export type AuthLinkPurpose = "recovery" | "sign-in";

export type AuthLinkParseResult =
  { ok: true; tokens: AuthLinkTokens } | { ok: false; message: string };

function invalidLinkMessage(purpose: AuthLinkPurpose): string {
  return purpose === "recovery"
    ? "This reset link is invalid or has expired."
    : "This sign-in link is invalid or has expired.";
}

function decodeParameter(value: string): string | undefined {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return undefined;
  }
}

function readParameters(raw: string): Map<string, string> {
  const parameters = new Map<string, string>();
  for (const entry of raw.split("&")) {
    if (!entry) continue;
    const separator = entry.indexOf("=");
    const rawKey = separator < 0 ? entry : entry.slice(0, separator);
    const rawValue = separator < 0 ? "" : entry.slice(separator + 1);
    const key = decodeParameter(rawKey);
    const value = decodeParameter(rawValue);
    if (key && value !== undefined) parameters.set(key, value);
  }
  return parameters;
}

function parametersFromUrl(value: string): Map<string, string> {
  const hashIndex = value.indexOf("#");
  const queryIndex = value.indexOf("?");
  const query =
    queryIndex < 0
      ? ""
      : value.slice(
          queryIndex + 1,
          hashIndex > queryIndex ? hashIndex : value.length,
        );
  const fragment = hashIndex < 0 ? "" : value.slice(hashIndex + 1);
  return new Map([...readParameters(query), ...readParameters(fragment)]);
}

function safeProviderMessage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 240) return undefined;
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return undefined;
  }
  return normalized;
}

/** Parse Supabase link tokens without depending on browser URL globals. */
export function parseAuthLink(
  value: string | null | undefined,
  purpose: AuthLinkPurpose,
): AuthLinkParseResult {
  const invalid = invalidLinkMessage(purpose);
  if (!value) return { ok: false, message: invalid };

  const parameters = parametersFromUrl(value);
  const providerError = safeProviderMessage(
    parameters.get("error_description"),
  );
  if (providerError) return { ok: false, message: providerError };

  const accessToken = parameters.get("access_token");
  const refreshToken = parameters.get("refresh_token");
  const type = parameters.get("type");
  const hasExpectedType =
    purpose === "recovery" ? type === "recovery" : type !== "recovery";

  if (!accessToken || !refreshToken || !hasExpectedType) {
    return { ok: false, message: invalid };
  }

  return { ok: true, tokens: { accessToken, refreshToken } };
}
