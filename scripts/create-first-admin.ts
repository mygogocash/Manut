/**
 * Ops script: create the first Manut administrator (admin@manut.xyz) with
 * mustChangePassword=true.
 *
 * Fail-closed: requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL),
 * SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL. Refuses otherwise.
 *
 * Credentials must come from the operator environment — never commit them.
 *
 * Usage (from repo root, after db seed so the system Admin role exists):
 *   pnpm ops:create-first-admin
 *
 * Optional: FIRST_ADMIN_TEMPORARY_PASSWORD — otherwise a random password is
 * generated and printed once to stdout (not written to any file).
 */

import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { config as loadDotenv } from "dotenv";

import {
  FIRST_ADMIN_EMAIL,
  FIRST_ADMIN_NAME,
  loadCreateFirstAdminEnvironment,
  type CreateFirstAdminEnvironment,
} from "./create-first-admin-env";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: join(repoRoot, ".env") });
loadDotenv({ path: join(repoRoot, ".env.local"), override: true });

/** Import the client factory only — never `@manut/database` index (eager Prisma). */
async function loadPrismaFactory() {
  const mod = await import("../packages/database/src/create-client.ts");
  return mod.createPrismaClient;
}

function randomTemporaryPassword(): string {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

function resolveTemporaryPassword(source: NodeJS.ProcessEnv): string {
  const fromEnv = source.FIRST_ADMIN_TEMPORARY_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return randomTemporaryPassword();
}

async function createSupabaseAuthUser(
  environment: CreateFirstAdminEnvironment,
  password: string,
): Promise<{ id: string; email: string }> {
  const response = await fetch(
    `${environment.supabaseUrl}/auth/v1/admin/users`,
    {
      method: "POST",
      headers: {
        apikey: environment.supabaseServiceRoleKey,
        Authorization: `Bearer ${environment.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      redirect: "error",
      body: JSON.stringify({
        email: FIRST_ADMIN_EMAIL,
        password,
        email_confirm: true,
        user_metadata: {
          name: FIRST_ADMIN_NAME,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase Admin createUser failed with status ${response.status}${
        detail ? `: ${detail.slice(0, 200)}` : "."
      }`,
    );
  }

  const body = (await response.json()) as {
    id?: unknown;
    email?: unknown;
    user?: { id?: unknown; email?: unknown };
  };
  const user = body.user ?? body;
  if (typeof user.id !== "string") {
    throw new Error("Supabase Admin createUser returned no user id.");
  }

  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : FIRST_ADMIN_EMAIL,
  };
}

async function deleteSupabaseAuthUser(
  environment: CreateFirstAdminEnvironment,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${environment.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: {
        apikey: environment.supabaseServiceRoleKey,
        Authorization: `Bearer ${environment.supabaseServiceRoleKey}`,
      },
      redirect: "error",
    },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Supabase Admin deleteUser failed with status ${response.status}.`,
    );
  }
}

export async function createFirstAdmin(
  source: NodeJS.ProcessEnv = process.env,
): Promise<{ userId: string; email: string; temporaryPassword: string }> {
  // Env gate first — refuse before any Prisma / network import side effects.
  const environment = loadCreateFirstAdminEnvironment(source);
  const temporaryPassword = resolveTemporaryPassword(source);
  const createPrismaClient = await loadPrismaFactory();
  const prisma = createPrismaClient(environment.databaseUrl);

  try {
    const existing = await prisma.user.findUnique({
      where: { email: FIRST_ADMIN_EMAIL },
      select: { id: true },
    });
    if (existing) {
      throw new Error(
        `Refusing to create the first admin — ${FIRST_ADMIN_EMAIL} already exists in the database.`,
      );
    }

    const adminRole = await prisma.role.findFirst({
      where: { name: "Admin", isSystem: true, deletedAt: null },
      select: { id: true },
    });
    if (!adminRole) {
      throw new Error(
        'Refusing to create the first admin — system role "Admin" is missing. Run pnpm db:seed first.',
      );
    }

    const authUser = await createSupabaseAuthUser(
      environment,
      temporaryPassword,
    );

    try {
      await prisma.user.create({
        data: {
          id: authUser.id,
          email: FIRST_ADMIN_EMAIL,
          name: FIRST_ADMIN_NAME,
          employeeId: "MANUT-001",
          mustChangePassword: true,
          isActive: true,
          userRoles: {
            create: {
              roleId: adminRole.id,
            },
          },
        },
      });
    } catch (error) {
      await deleteSupabaseAuthUser(environment, authUser.id);
      throw error;
    }

    return {
      userId: authUser.id,
      email: FIRST_ADMIN_EMAIL,
      temporaryPassword,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const result = await createFirstAdmin();
  // Print the temporary password once for the operator. Do not write it to a
  // file and never commit it.
  console.log(
    [
      "Created first admin successfully.",
      `  email: ${result.email}`,
      `  userId: ${result.userId}`,
      "  mustChangePassword: true",
      `  temporaryPassword: ${result.temporaryPassword}`,
      "",
      "Sign in once, then change the password immediately.",
      "Do not store this password in git, tickets, or shared chat logs.",
    ].join("\n"),
  );
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
