import { resolve } from "node:path";

export const REPOSITORY_ROOT = process.cwd();
export const DATABASE_ROOT = resolve(REPOSITORY_ROOT, "packages/database");

export const E2E_RUNTIME_ROOT = resolve(
  REPOSITORY_ROOT,
  ".playwright/e2e-auth",
);
export const E2E_ARTIFACT_ROOT = resolve(REPOSITORY_ROOT, "e2e/.artifacts");
export const PERSONAS_PATH = resolve(E2E_RUNTIME_ROOT, "personas.json");
export const ADMIN_STORAGE_STATE = resolve(E2E_RUNTIME_ROOT, "admin.json");
export const EMPLOYEE_STORAGE_STATE = resolve(
  E2E_RUNTIME_ROOT,
  "employee.json",
);

export const RESET_PUBLIC_SCHEMA_SQL = resolve(
  REPOSITORY_ROOT,
  "scripts/e2e/reset-public-schema.sql",
);
