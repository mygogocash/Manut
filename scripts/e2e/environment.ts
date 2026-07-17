export const E2E_PROJECT_NAME = "manut-intranet-e2e";

type RequiredVariable =
  | "E2E_SUPABASE_URL"
  | "E2E_SUPABASE_ANON_KEY"
  | "E2E_SUPABASE_SERVICE_ROLE_KEY"
  | "E2E_DATABASE_URL"
  | "E2E_DIRECT_URL";

export interface E2EEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  databaseUrl: string;
  directUrl: string;
  projectRef: string;
}

function required(source: NodeJS.ProcessEnv, name: RequiredVariable): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the authenticated E2E gate.`);
  }
  return value;
}

function parseUrl(value: string, variable: RequiredVariable): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${variable} must be a valid URL.`);
  }
}

function supabaseProjectRef(url: URL): string | undefined {
  if (url.protocol !== "https:") return undefined;
  return url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
}

function databaseProjectRefs(url: URL): Set<string> {
  const refs = new Set<string>();
  const hostRef = url.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  const userRef = decodeURIComponent(url.username).match(
    /^postgres\.([a-z0-9-]+)$/i,
  )?.[1];

  if (hostRef) refs.add(hostRef);
  if (userRef) refs.add(userRef);
  return refs;
}

function assertDatabaseTargetsProject(
  value: string,
  variable: "E2E_DATABASE_URL" | "E2E_DIRECT_URL",
  expectedRef: string,
): void {
  const url = parseUrl(value, variable);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${variable} must use the PostgreSQL protocol.`);
  }

  const refs = databaseProjectRefs(url);
  if (refs.size !== 1 || !refs.has(expectedRef)) {
    throw new Error(
      `${variable} must prove that it targets the same dedicated Supabase project as E2E_SUPABASE_URL.`,
    );
  }
}

export function loadE2EEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): E2EEnvironment {
  const supabaseUrl = required(source, "E2E_SUPABASE_URL");
  const supabaseAnonKey = required(source, "E2E_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = required(
    source,
    "E2E_SUPABASE_SERVICE_ROLE_KEY",
  );
  const databaseUrl = required(source, "E2E_DATABASE_URL");
  const directUrl = required(source, "E2E_DIRECT_URL");

  const projectRef = supabaseProjectRef(
    parseUrl(supabaseUrl, "E2E_SUPABASE_URL"),
  );
  if (!projectRef) {
    throw new Error(
      "E2E_SUPABASE_URL must be the HTTPS URL of a hosted Supabase project.",
    );
  }

  assertDatabaseTargetsProject(databaseUrl, "E2E_DATABASE_URL", projectRef);
  assertDatabaseTargetsProject(directUrl, "E2E_DIRECT_URL", projectRef);

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey,
    supabaseServiceRoleKey,
    databaseUrl,
    directUrl,
    projectRef,
  };
}
