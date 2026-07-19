import { Platform } from "react-native";

import { normalizeApiBaseUrl } from "@manut/app-core";

export function getApiBaseUrl(): string {
  // Prefer Platform.OS over process.env.EXPO_OS: Metro/Jest inline EXPO_OS, so
  // runtime assignment in tests cannot flip the web vs native contract.
  const platform = Platform.OS === "web" ? "web" : "native";
  return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, platform);
}

export function requirePublicEnv(
  name: string,
  value: string | undefined,
): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required for native API routing.`);
  }
  return value.trim();
}
