import { HttpError } from "./http-error";
import type { RuntimeBindings } from "./runtime";

function enabled(value: string | undefined): boolean {
  return value === "true";
}

/**
 * Hyperdrive is the only approved Worker path to PostgreSQL.
 * Both the boundary flag and the `HYPERDRIVE_DATABASE` binding must be present.
 */
export function isHyperdriveEnabled(env: RuntimeBindings): boolean {
  return (
    enabled(env.ENABLE_HYPERDRIVE_BOUNDARY) &&
    env.HYPERDRIVE_DATABASE !== undefined
  );
}

export function requireHyperdrive(env: RuntimeBindings): Hyperdrive {
  if (!isHyperdriveEnabled(env) || !env.HYPERDRIVE_DATABASE) {
    throw new HttpError(
      503,
      "HYPERDRIVE_NOT_PROVISIONED",
      "Database capability is disabled.",
    );
  }
  return env.HYPERDRIVE_DATABASE;
}

/**
 * Connection string for Prisma/pg comes only from the Hyperdrive binding.
 * Never fall back to `DATABASE_URL` or other secrets in the Worker.
 */
export function hyperdriveConnectionString(env: RuntimeBindings): string {
  const hyperdrive = requireHyperdrive(env);
  const connectionString = hyperdrive.connectionString?.trim() ?? "";
  if (!connectionString) {
    throw new HttpError(
      503,
      "HYPERDRIVE_NOT_PROVISIONED",
      "Database capability is disabled.",
    );
  }
  return connectionString;
}
