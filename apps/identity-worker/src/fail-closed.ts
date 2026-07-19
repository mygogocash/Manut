import type { IdentityBindings } from "./runtime";

export type IdentityResourceMode = "fail_closed" | "ready";

/**
 * Identity D1 must be a real Manut-owned preview binding.
 * Empty wrangler `d1_databases` + missing IDENTITY_DB → fail closed.
 * Never invent Hyperdrive or D1 ids to make this return "ready".
 */
export function resolveIdentityDbMode(
  env: IdentityBindings,
): IdentityResourceMode {
  if (env.IDENTITY_DB === undefined) return "fail_closed";
  return "ready";
}

export function requireIdentityDb(env: IdentityBindings): D1Database {
  if (env.IDENTITY_DB === undefined) {
    throw new IdentityHttpError(
      503,
      "IDENTITY_D1_NOT_PROVISIONED",
      "Identity database capability is disabled until a Manut-owned preview D1 is bound.",
    );
  }
  return env.IDENTITY_DB;
}

export class IdentityHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "IdentityHttpError";
    this.status = status;
    this.code = code;
  }

  toJSON(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }
}
