/**
 * Cloudflare bindings for the Identity spike Worker.
 * IDENTITY_DB is optional until ops provisions a real preview D1 id.
 */
export interface IdentityBindings {
  IDENTITY_DB?: D1Database;
  IDENTITY_SPIKE_MODE?: string;
  BETTER_AUTH_PINNED_VERSION?: string;
}

export function isStubMode(env: IdentityBindings): boolean {
  return (env.IDENTITY_SPIKE_MODE ?? "stub") === "stub";
}
