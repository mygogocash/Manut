export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(
    /\/+$/,
    "",
  );
  if (configured) return configured;
  if (process.env.EXPO_OS === "web") return "/api";
  return requirePublicEnv(
    "EXPO_PUBLIC_API_URL",
    process.env.EXPO_PUBLIC_API_URL,
  );
}

export function requirePublicEnv(
  name: string,
  value: string | undefined,
): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required for native authentication.`);
  }
  return value.trim();
}
