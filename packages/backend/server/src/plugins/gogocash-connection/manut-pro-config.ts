/**
 * Typed environment-variable accessors for the GoGoCash connection scaffold.
 *
 * Optional:
 *   - GOGOCASH_API_KEY — when set on the server, becomes the default
 *     workspace-wide key (used if the workspace user hasn't saved a
 *     workspace-scoped key). Useful for self-hosted Manut deployments
 *     where every workspace shares one internal credential. Not the
 *     standard pattern — most deployments will want per-workspace keys.
 *
 * Like the MongoDB / PostHog scaffolds, the connector is always
 * "configured" — there's no admin-side env that gates the resolver.
 */

export interface GoGoCashConnectionEnv {
  serverWideApiKey?: string;
}

export function readGoGoCashConnectionEnv(): GoGoCashConnectionEnv {
  return {
    serverWideApiKey: process.env.GOGOCASH_API_KEY,
  };
}

export function isGoGoCashConnectionConfigured(): boolean {
  return true;
}
