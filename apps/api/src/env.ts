import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

function dotenvPaths(): string[] {
  const cwd = process.cwd();
  const explicit = process.env.DOTENV_PATH?.trim();
  if (explicit) {
    return [resolve(cwd, explicit), resolve(explicit)];
  }

  const mode = process.env.NODE_ENV;
  const modeFile =
    mode === "production" || mode === "development" ? `.env.${mode}` : null;

  return [
    ...(modeFile
      ? [resolve(cwd, modeFile), resolve(cwd, "../../", modeFile)]
      : []),
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
