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

export type RuntimeBindings = CloudflareBindings & FuturePlatformBindings;

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
