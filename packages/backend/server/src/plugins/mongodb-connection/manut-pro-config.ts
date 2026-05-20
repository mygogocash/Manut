/**
 * Typed environment-variable accessors for the MongoDB connection scaffold.
 *
 * Optional:
 *   - MONGODB_DEFAULT_URI — when set, the frontend can pre-fill the
 *     connection input with this URI as a placeholder. NEVER use it
 *     as an actual default — workspaces must explicitly opt in by
 *     hitting "Save" so we don't auto-connect to the server's own
 *     analytics DB on workspace creation.
 *
 * Unlike the OAuth scaffolds, there is NO required env var here —
 * the connector is "configured" when a workspace user provides a URI,
 * not when an admin sets an env var. This is the structural difference
 * between OAuth-style and direct-URI-style integrations.
 */

export interface MongoDbConnectionEnv {
  defaultUriHint?: string;
}

export function readMongoDbConnectionEnv(): MongoDbConnectionEnv {
  return {
    defaultUriHint: process.env.MONGODB_DEFAULT_URI,
  };
}

/**
 * Returns true when the connector is server-configured. For MongoDB
 * this is always true — there are no env vars required for the
 * integration to function. Provided for parity with the OAuth
 * scaffolds' `is*Configured` API surface.
 */
export function isMongoDbConnectionConfigured(): boolean {
  return true;
}
