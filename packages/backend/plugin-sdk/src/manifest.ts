import { z } from 'zod';

import { PLUGIN_CAPABILITIES, type PluginCapability } from './capabilities.js';

/**
 * Zod schemas describing the plugin manifest. The host validates the
 * manifest at install time and again at process spawn — every field
 * is treated as untrusted external input.
 *
 * Identifier shapes (NAME_PATTERN, METHOD_ENUM, PATH_PATTERN) are tight
 * on purpose: an over-permissive route pattern is how the v1.x plugin
 * shims used to shadow `/api/workspaces/...` and silently hijack core
 * endpoints. Path validation refuses leading slash conflicts at install
 * time — see `manut-plugin-installer.service.ts`.
 */

/** lowercase ASCII, digits, hyphen, optional dot. Mirrors MnSkill slug. */
const NAME_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

const NAME_MAX = 200;
const VERSION_MAX = 64;
const VERSION_PATTERN = /^[A-Za-z0-9._+-]+$/;

const HOST_API_VERSION_PATTERN = /^[0-9]+(?:\.[0-9]+){0,2}$/;

/**
 * Relative API path. Must start with `/`, contain only safe characters,
 * and explicitly disallow `..` segments so a plugin can't escape its
 * mount point. Trailing wildcards (`/*`) are allowed for a plugin that
 * wants to claim a subtree.
 */
const PATH_PATTERN = /^\/[A-Za-z0-9_\-./:*]*$/;

const HTTP_METHOD_ENUM = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type PluginHttpMethod = (typeof HTTP_METHOD_ENUM)[number];

/**
 * Capability gate. We use `z.enum` over the tuple form so unknown
 * capabilities are rejected at parse time, not silently allowed.
 */
const CapabilitySchema: z.ZodType<PluginCapability> = z.enum(
  PLUGIN_CAPABILITIES as unknown as [PluginCapability, ...PluginCapability[]]
);

/**
 * A tool exposed by the plugin. `inputSchemaJson` is optional but
 * recommended — when present the host validates inputs before they
 * cross the IPC boundary.
 */
export const PluginToolSchema = z.object({
  name: z.string().min(1).max(NAME_MAX).regex(NAME_PATTERN, {
    message:
      'tool name must be lowercase alphanumeric with optional - or . separators',
  }),
  description: z.string().min(1).max(2000),
  /** JSON-schema (as a JSON string) describing the tool's input shape. */
  inputSchemaJson: z.string().max(50_000).optional(),
  /**
   * Dotted path inside the plugin package that exports the tool factory.
   * The host does not import this directly — the plugin worker
   * `require`s it inside its own process.
   */
  factory: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[A-Za-z0-9_$./-]+$/, {
      message: 'factory must be a relative path or dotted identifier',
    }),
});

export type PluginTool = z.infer<typeof PluginToolSchema>;

/**
 * An HTTP route exposed by the plugin. The host mounts these under
 * `/api/plugins/:pluginId/api/<path>` so they cannot shadow core
 * routes by accident, and they inherit the same auth as core APIs.
 */
export const PluginApiRouteSchema = z.object({
  method: z.enum(HTTP_METHOD_ENUM),
  path: z.string().min(1).max(500).regex(PATH_PATTERN, {
    message: 'path must start with / and contain only [A-Za-z0-9_-./:*]',
  }),
  capability: CapabilitySchema,
  /**
   * Dotted path inside the plugin package that exports the handler.
   * Same convention as `PluginTool.factory`.
   */
  handler: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[A-Za-z0-9_$./-]+$/, {
      message: 'handler must be a relative path or dotted identifier',
    }),
});

export type PluginApiRoute = z.infer<typeof PluginApiRouteSchema>;

/**
 * Top-level plugin manifest. Persisted as a JSON blob on the
 * `MnPlugin` row; re-validated at every process spawn.
 */
export const PluginManifestSchema = z.object({
  name: z.string().min(1).max(NAME_MAX).regex(NAME_PATTERN, {
    message:
      'plugin name must be lowercase alphanumeric with optional - or . separators',
  }),
  version: z.string().min(1).max(VERSION_MAX).regex(VERSION_PATTERN, {
    message: 'version must use [A-Za-z0-9._+-] characters only',
  }),
  /**
   * SemVer-ish indicator of which host API version this plugin targets.
   * The host refuses to spawn a plugin whose major does not match
   * `HOST_API_VERSION_MAJOR` declared in the runtime service.
   */
  hostApiVersion: z.string().regex(HOST_API_VERSION_PATTERN, {
    message: 'hostApiVersion must look like "1", "1.0" or "1.0.0"',
  }),
  capabilities: z.array(CapabilitySchema).max(PLUGIN_CAPABILITIES.length),
  tools: z.array(PluginToolSchema).max(64).default([]),
  apiRoutes: z.array(PluginApiRouteSchema).max(64).default([]),
  description: z.string().max(2000).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Helper for plugins to declare their manifest + factory in one call.
 * The worker entrypoint imports the default export of the plugin
 * package and inspects this object.
 *
 * Returns the manifest unchanged when valid; throws a ZodError when
 * the manifest is malformed so the install step rejects bad plugins
 * before they ever reach the runtime.
 */
export interface PluginRegistration<TContext = unknown> {
  manifest: PluginManifest;
  /**
   * Optional factory run inside the plugin process right after the
   * worker connects to the host RPC bridge. Receives the typed host
   * RPC client (see `host-rpc.ts`); use it to register listeners or
   * cache long-lived references.
   */
  factory?: (ctx: TContext) => void | Promise<void>;
}

export function definePlugin<TContext = unknown>(
  manifest: PluginManifest,
  factory?: PluginRegistration<TContext>['factory']
): PluginRegistration<TContext> {
  const parsed = PluginManifestSchema.parse(manifest);
  const registration: PluginRegistration<TContext> = { manifest: parsed };
  if (factory !== undefined) {
    registration.factory = factory;
  }
  return registration;
}
