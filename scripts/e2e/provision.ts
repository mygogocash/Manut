import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  E2E_PROJECT_NAME,
  type E2EEnvironment,
  loadE2EEnvironment,
} from "./environment";
import { buildFixtureSql } from "./fixtures";
import { RESET_PUBLIC_SCHEMA_SQL } from "./paths";
import {
  type PersonaManifest,
  readPersonaManifest,
  removeRuntimeDirectory,
  removeStorageStates,
  type RuntimePersona,
  writePersonaManifest,
} from "./personas";
import { deployMigrations, executeSql } from "./prisma";
import { createConfirmedUser, deleteUser } from "./supabase-admin";

function randomPassword(): string {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

function runId(): string {
  return randomBytes(8).toString("hex");
}

async function deleteManifestUsers(
  environment: E2EEnvironment,
  manifest: PersonaManifest,
): Promise<void> {
  if (manifest.projectRef !== environment.projectRef) {
    throw new Error(
      "Refusing to delete stale personas because their project ref differs from the configured E2E project.",
    );
  }

  const results = await Promise.allSettled(
    manifest.personas.map((candidate) => deleteUser(environment, candidate.id)),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(`Failed to delete ${failures.length} E2E runtime user(s).`);
  }
}

async function createPersona(
  environment: E2EEnvironment,
  manifest: PersonaManifest,
  kind: RuntimePersona["kind"],
): Promise<void> {
  const name = kind === "admin" ? "E2E Administrator" : "E2E Employee";
  const email = `e2e-${kind}+${manifest.runId}@example.invalid`;
  const password = randomPassword();
  const created = await createConfirmedUser(environment, {
    email,
    password,
    name,
  });

  manifest.personas.push({
    kind,
    id: created.id,
    email: created.email,
    password,
    name,
  });
  await writePersonaManifest(manifest);
}

export async function provisionE2E(): Promise<void> {
  const environment = loadE2EEnvironment();
  const staleManifest = await readPersonaManifest();
  if (staleManifest) {
    await deleteManifestUsers(environment, staleManifest);
  }
  await removeRuntimeDirectory();

  const resetSql = await readFile(RESET_PUBLIC_SCHEMA_SQL, "utf8");
  await executeSql(environment, resetSql, "Guarded E2E public-schema reset");
  await deployMigrations(environment);

  const manifest: PersonaManifest = {
    projectName: E2E_PROJECT_NAME,
    projectRef: environment.projectRef,
    runId: runId(),
    createdAt: new Date().toISOString(),
    personas: [],
  };

  try {
    await writePersonaManifest(manifest);
    await createPersona(environment, manifest, "admin");
    await createPersona(environment, manifest, "employee");
    await executeSql(
      environment,
      buildFixtureSql(manifest),
      "E2E fixture seed",
    );
  } catch (error) {
    const cleanup = await Promise.allSettled(
      manifest.personas.map((candidate) =>
        deleteUser(environment, candidate.id),
      ),
    );
    if (cleanup.every((result) => result.status === "fulfilled")) {
      await removeRuntimeDirectory();
    }
    throw error;
  }
}

export async function cleanupE2E(): Promise<void> {
  const environment = loadE2EEnvironment();
  const manifest = await readPersonaManifest();
  if (!manifest) {
    await removeStorageStates();
    return;
  }

  await deleteManifestUsers(environment, manifest);
  await removeRuntimeDirectory();
}
