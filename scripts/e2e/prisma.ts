import { spawn } from "node:child_process";

import type { E2EEnvironment } from "./environment";
import { DATABASE_ROOT } from "./paths";

interface PrismaCommand {
  label: string;
  args: string[];
  stdin?: string;
}

function prismaEnvironment(environment: E2EEnvironment): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: environment.databaseUrl,
    DIRECT_URL: environment.directUrl,
    DOTENV_CONFIG_QUIET: "true",
  };
}

async function runPrisma(
  environment: E2EEnvironment,
  command: PrismaCommand,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "prisma", ...command.args], {
      cwd: DATABASE_ROOT,
      env: prismaEnvironment(environment),
      stdio: ["pipe", "inherit", "inherit"],
    });

    child.once("error", () => {
      reject(new Error(`${command.label} could not be started.`));
    });
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command.label} failed with exit code ${code}.`));
    });

    child.stdin.end(command.stdin);
  });
}

export async function executeSql(
  environment: E2EEnvironment,
  sql: string,
  label: string,
): Promise<void> {
  await runPrisma(environment, {
    label,
    args: ["db", "execute", "--schema", "prisma/schema", "--stdin"],
    stdin: sql,
  });
}

export async function deployMigrations(
  environment: E2EEnvironment,
): Promise<void> {
  await runPrisma(environment, {
    label: "E2E migration deploy",
    args: ["migrate", "deploy", "--schema", "prisma/schema"],
  });
}
