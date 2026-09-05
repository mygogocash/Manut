import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

function dotenvPaths(): string[] {
  // Vercel / Cloud Run inject env vars; don't pull gitignored .env files.
  if (process.env.VERCEL || process.env.K_SERVICE) {
    return [];
  }

  const cwd = process.cwd();
  const explicit = process.env.DOTENV_PATH?.trim();
  if (explicit) {
    return [resolve(cwd, explicit), resolve(explicit)];
  }

  const mode = process.env.NODE_ENV;
  const modeFile =
    mode === "production" || mode === "development" ? `.env.${mode}` : null;

  // When NODE_ENV is unset (common under `turbo dev`), still prefer the
  // local development file so Supabase/DB keys load instead of falling
  // through to a missing root `.env` and leaving auth unconfigured.
  return [
    ...(modeFile
      ? [resolve(cwd, modeFile), resolve(cwd, "../../", modeFile)]
      : [
          resolve(cwd, ".env.development"),
          resolve(cwd, "../../.env.development"),
        ]),
    resolve(cwd, ".env"),
    resolve(cwd, "../../.env"),
  ];
}

for (const envPath of dotenvPaths()) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}
