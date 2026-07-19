/**
 * Fail-closed environment gate for the first-admin bootstrap script.
 * Pure module — no network, no credentials written to disk.
 */

export const FIRST_ADMIN_EMAIL = "admin@manut.xyz";
export const FIRST_ADMIN_NAME = "Manut Administrator";

export interface CreateFirstAdminEnvironment {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  databaseUrl: string;
}

export class BootstrapEnvironmentError extends Error {
  readonly code = "BOOTSTRAP_ENV_REFUSED" as const;

  constructor(message: string) {
    super(message);
    this.name = "BootstrapEnvironmentError";
  }
}

function readTrimmed(
  source: NodeJS.ProcessEnv,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = source[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function assertHttpsUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BootstrapEnvironmentError(
      `Refusing to create the first admin — ${label} must be a valid HTTPS URL.`,
    );
  }
  if (parsed.protocol !== "https:") {
    throw new BootstrapEnvironmentError(
      `Refusing to create the first admin — ${label} must use https:.`,
    );
  }
  return value.replace(/\/+$/, "");
}

function assertPostgresUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BootstrapEnvironmentError(
      `Refusing to create the first admin — ${label} must be a valid PostgreSQL URL.`,
    );
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new BootstrapEnvironmentError(
      `Refusing to create the first admin — ${label} must use the PostgreSQL protocol.`,
    );
  }
  return value;
}

/**
 * Loads bootstrap env. Refuses (throws BootstrapEnvironmentError) unless
 * SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, and
 * DATABASE_URL are all present and well-formed.
 */
export function loadCreateFirstAdminEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): CreateFirstAdminEnvironment {
  const missing: string[] = [];

  const supabaseUrlRaw = readTrimmed(source, [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
  ]);
  if (!supabaseUrlRaw) {
    missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  }

  const supabaseServiceRoleKey = readTrimmed(source, [
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  if (!supabaseServiceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  const databaseUrlRaw = readTrimmed(source, ["DATABASE_URL"]);
  if (!databaseUrlRaw) {
    missing.push("DATABASE_URL");
  }

  if (
    missing.length > 0 ||
    !supabaseUrlRaw ||
    !supabaseServiceRoleKey ||
    !databaseUrlRaw
  ) {
    throw new BootstrapEnvironmentError(
      [
        "Refusing to create the first admin — required environment is incomplete.",
        "This ops script is fail-closed and will not invent credentials or connect without:",
        ...missing.map((name) => `  - ${name}`),
        "",
        "Provide Manut-owned values via the process environment (or a gitignored local .env).",
        "Never commit service-role keys, database URLs, or temporary passwords.",
      ].join("\n"),
    );
  }

  return {
    supabaseUrl: assertHttpsUrl(supabaseUrlRaw, "SUPABASE_URL"),
    supabaseServiceRoleKey,
    databaseUrl: assertPostgresUrl(databaseUrlRaw, "DATABASE_URL"),
  };
}
