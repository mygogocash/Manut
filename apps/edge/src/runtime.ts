export interface AuthPrincipal {
  role: string | null;
  subject: string;
}

export interface PresentedCredential {
  source: "bearer" | "cookie";
  token: string;
}

export type FuturePlatformBindings = {
  CONTAINER_BOUNDARY?: DurableObjectNamespace;
  HYPERDRIVE_DATABASE?: Hyperdrive;
};

/**
 * Optional S3-compatible R2 credentials for SigV4 client→R2 transfers.
 * Not listed in wrangler `secrets.required` (deploy uses the UPLOADS binding
 * when unset); still present at runtime when ops sets them via
 * `wrangler secret put`.
 */
export type OptionalR2SigningSecrets = {
  R2_ACCESS_KEY_ID?: string;
  R2_ACCOUNT_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};

export type RuntimeBindings = CloudflareBindings &
  FuturePlatformBindings &
  OptionalR2SigningSecrets;

export type EdgeVariables = {
  credential: PresentedCredential;
  principal: AuthPrincipal;
  principalKey: string;
  requestId: string;
};

export type EdgeEnv = {
  Bindings: RuntimeBindings;
  Variables: EdgeVariables;
};
