import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnPluginStatus } from '@prisma/client';
import { GraphQLJSON } from 'graphql-scalars';
import { z } from 'zod';

/**
 * GraphQL + Zod surface for the M6a plugin runtime.
 *
 * EVERY nullable `@Field` uses the explicit `() => Type` form because
 * NestJS reflection cannot infer GraphQL types from TypeScript unions
 * that include `null`. Shipping `@Field({ nullable: true })` without
 * the type arrow crashes the server on startup (v1.7.0 + v1.10.2 scars,
 * CLAUDE.md §6). Keep it explicit.
 */

registerEnumType(MnPluginStatus, {
  name: 'MnPluginStatus',
  description:
    'Lifecycle status of an installed plugin: INSTALLED (manifest in DB, ' +
    'not yet enabled), LOADING (spawning), RUNNING (worker alive), ' +
    'CRASHED (supervisor parked it after N restart failures), ' +
    'DISABLED (operator paused it).',
});

const PLUGIN_NAME_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
const PLUGIN_VERSION_PATTERN = /^[A-Za-z0-9._+-]+$/;

export const InstallPluginSchema = z.object({
  name: z.string().min(1).max(200).regex(PLUGIN_NAME_PATTERN, {
    message:
      'plugin name must be lowercase alphanumeric with optional - or . separators',
  }),
  version: z.string().min(1).max(64).regex(PLUGIN_VERSION_PATTERN, {
    message: 'version must use [A-Za-z0-9._+-] characters only',
  }),
});

export type InstallPluginValues = z.infer<typeof InstallPluginSchema>;

@InputType('InstallMnPluginInput')
export class InstallMnPluginInput {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  version!: string;
}

@ObjectType('MnPlugin')
export class MnPluginObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  version!: string;

  @Field(() => GraphQLJSON)
  manifestJson!: unknown;

  @Field(() => String, { nullable: true })
  packagePath!: string | null;

  @Field(() => MnPluginStatus)
  processStatus!: MnPluginStatus;

  @Field(() => GraphQLISODateTime, { nullable: true })
  enabledAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  installedAt!: Date;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

// ---------------------------------------------------------------------------
// M6b — per-workspace plugin enable + config surface.
// ---------------------------------------------------------------------------

/**
 * Per-workspace plugin configuration row. `configJson` is intentionally
 * an unstructured JSON blob so plugin authors can hang arbitrary options
 * off it (API keys, feature flags, capability overrides). The control
 * plane treats one well-known field specially: `configJson.enabled`,
 * which is what the workspace-settings toggle flips. Other fields are
 * read by plugins via the host RPC bridge.
 *
 * Every nullable @Field uses the explicit `() => Type` form per the
 * v1.7.0 / v1.10.2 UndefinedTypeError scars (CLAUDE.md §6).
 */
@ObjectType('MnPluginConfig')
export class MnPluginConfigObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  pluginId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => ID, { nullable: true })
  projectId!: string | null;

  @Field(() => GraphQLJSON)
  configJson!: unknown;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

export const UpsertMnPluginConfigSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  pluginId: z.string().min(1).max(64),
  projectId: z.string().min(1).max(64).nullable().optional(),
  configJson: z.record(z.unknown()).default({}),
});

export type UpsertMnPluginConfigValues = z.infer<
  typeof UpsertMnPluginConfigSchema
>;

@InputType('UpsertMnPluginConfigInput')
export class UpsertMnPluginConfigInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => ID)
  pluginId!: string;

  @Field(() => ID, { nullable: true })
  projectId?: string | null;

  /**
   * Opaque JSON payload — plugin authors document the shape. The
   * `enabled` boolean inside is the per-workspace on/off switch the UI
   * toggles. Bounded to 16 KB by the resolver to prevent runaway
   * configs poisoning the DB.
   */
  @Field(() => GraphQLJSON)
  configJson!: Record<string, unknown>;
}

/**
 * Hard cap on serialised config payloads. 16 KB is plenty for sane
 * configs (API keys, flag maps, capability overrides) and small enough
 * to keep one bad actor from filling the DB.
 */
export const MN_PLUGIN_CONFIG_MAX_BYTES = 16 * 1024;
