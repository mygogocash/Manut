import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

import { E2E_PROJECT_NAME } from "./environment";
import {
  ADMIN_STORAGE_STATE,
  E2E_RUNTIME_ROOT,
  EMPLOYEE_STORAGE_STATE,
  PERSONAS_PATH,
} from "./paths";

export type PersonaKind = "admin" | "employee";

export interface RuntimePersona {
  kind: PersonaKind;
  id: string;
  email: string;
  password: string;
  name: string;
}

export interface PersonaManifest {
  projectName: typeof E2E_PROJECT_NAME;
  projectRef: string;
  runId: string;
  createdAt: string;
  personas: RuntimePersona[];
}

function isRuntimePersona(value: unknown): value is RuntimePersona {
  if (!value || typeof value !== "object") return false;
  const persona = value as Partial<RuntimePersona>;
  return (
    (persona.kind === "admin" || persona.kind === "employee") &&
    typeof persona.id === "string" &&
    typeof persona.email === "string" &&
    typeof persona.password === "string" &&
    typeof persona.name === "string"
  );
}

function isPersonaManifest(value: unknown): value is PersonaManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<PersonaManifest>;
  return (
    manifest.projectName === E2E_PROJECT_NAME &&
    typeof manifest.projectRef === "string" &&
    typeof manifest.runId === "string" &&
    typeof manifest.createdAt === "string" &&
    Array.isArray(manifest.personas) &&
    manifest.personas.every(isRuntimePersona)
  );
}

export async function readPersonaManifest(): Promise<PersonaManifest | null> {
  try {
    const raw = await readFile(PERSONAS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isPersonaManifest(parsed)) {
      throw new Error("The E2E persona manifest is malformed.");
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function requirePersona(
  kind: PersonaKind,
): Promise<RuntimePersona> {
  const manifest = await readPersonaManifest();
  const persona = manifest?.personas.find(
    (candidate) => candidate.kind === kind,
  );
  if (!persona) {
    throw new Error(`The ${kind} E2E persona has not been provisioned.`);
  }
  return persona;
}

export async function writePersonaManifest(
  manifest: PersonaManifest,
): Promise<void> {
  await mkdir(E2E_RUNTIME_ROOT, { recursive: true, mode: 0o700 });
  const temporaryPath = `${PERSONAS_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, PERSONAS_PATH);
}

export async function removeStorageStates(): Promise<void> {
  await Promise.all([
    rm(ADMIN_STORAGE_STATE, { force: true }),
    rm(EMPLOYEE_STORAGE_STATE, { force: true }),
  ]);
}

export async function removeRuntimeDirectory(): Promise<void> {
  await rm(E2E_RUNTIME_ROOT, { recursive: true, force: true });
}
