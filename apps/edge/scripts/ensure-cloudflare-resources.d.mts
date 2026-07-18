// Hand-written declarations for ensure-cloudflare-resources.mjs so TypeScript
// tests type-check the script's public API without enabling allowJs. Keep in
// sync with the .mjs implementation (vitest executes the real module).
export interface WranglerExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type WranglerExec = (
  args: readonly string[],
) => Promise<WranglerExecResult>;

export type ResourceKind = "queue" | "r2-bucket";

export type EnsureOutcome = "exists" | "created";

export interface ResourcePlan {
  queues: string[];
  r2Buckets: string[];
}

export interface EnsuredResource {
  kind: ResourceKind;
  name: string;
  outcome: EnsureOutcome;
}

export declare function collectResourceNames(
  wranglerSource: string,
  envName: string,
): ResourcePlan;

export declare function createWranglerExec(): WranglerExec;

export declare function ensureResource(
  kind: ResourceKind,
  name: string,
  exec: WranglerExec,
): Promise<EnsureOutcome>;

export declare function ensureResources(options: {
  envName: string;
  wranglerSource: string;
  exec: WranglerExec;
}): Promise<EnsuredResource[]>;
