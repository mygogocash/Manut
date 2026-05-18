import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import {
  InstallMnPluginInput,
  InstallPluginSchema,
  MnPluginConfigObjectType,
  MnPluginObjectType,
  UpsertMnPluginConfigInput,
  UpsertMnPluginConfigSchema,
} from './manut-plugin.dto';
import { ManutPluginConfigService } from './manut-plugin-config.service';
import { ManutPluginInstallerService } from './manut-plugin-installer.service';
import { ManutPluginRuntimeService } from './manut-plugin-runtime.service';

/**
 * GraphQL surface for the plugin runtime. Instance-admin only —
 * the `assertAdmin` helper rejects any non-admin caller before any
 * mutation runs.
 *
 * Every nullable `@Field` on the DTOs uses the explicit `() => Type`
 * form per CLAUDE.md §6 (UndefinedTypeError trap).
 */
@Resolver(() => MnPluginObjectType)
export class ManutPluginResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly installer: ManutPluginInstallerService,
    private readonly runtime: ManutPluginRuntimeService,
    private readonly ac: AccessController,
    private readonly configService: ManutPluginConfigService
  ) {}

  @Query(() => [MnPluginObjectType], {
    description:
      'List every installed plugin (instance-wide). Admin-only because ' +
      'plugin lifecycle is an operator concern, not a workspace concern.',
  })
  async mnPlugins(
    @CurrentUser() user: CurrentUser
  ): Promise<MnPluginObjectType[]> {
    await this.assertAdmin(user);
    const rows = await this.db.mnPlugin.findMany({
      orderBy: { installedAt: 'desc' },
    });
    return rows.map(toObjectType);
  }

  @Query(() => MnPluginObjectType, {
    nullable: true,
    description: 'Fetch a single plugin by id. Returns null when missing.',
  })
  async mnPlugin(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnPluginObjectType | null> {
    await this.assertAdmin(user);
    const row = await this.db.mnPlugin.findUnique({ where: { id } });
    return row ? toObjectType(row) : null;
  }

  @Mutation(() => MnPluginObjectType, {
    description:
      'Install a plugin from npm by package name + version. Runs ' +
      '`npm install` under the instance plugin directory, validates the ' +
      'declared manifest, and persists an MnPlugin row in INSTALLED status.',
  })
  async installMnPlugin(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => InstallMnPluginInput })
    input: InstallMnPluginInput
  ): Promise<MnPluginObjectType> {
    await this.assertAdmin(user);
    const values = InstallPluginSchema.parse(input);
    const row = await this.installer.install(values);
    return toObjectType(row);
  }

  @Mutation(() => MnPluginObjectType, {
    description:
      'Enable a plugin: flip its status to LOADING and spawn the worker ' +
      'process. Idempotent for an already-running plugin.',
  })
  async enableMnPlugin(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnPluginObjectType> {
    await this.assertAdmin(user);
    const row = await this.runtime.enable(id);
    return toObjectType(row);
  }

  @Mutation(() => MnPluginObjectType, {
    description:
      'Disable a plugin: terminate the worker process and mark DISABLED. ' +
      'Pending RPC calls reject with rpc_disposed.',
  })
  async disableMnPlugin(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnPluginObjectType> {
    await this.assertAdmin(user);
    const row = await this.runtime.disable(id);
    return toObjectType(row);
  }

  @Mutation(() => Boolean, {
    description:
      'Uninstall a plugin: disables it if running, deletes the MnPlugin ' +
      'row, and leaves the on-disk package directory in place so an ' +
      'operator can audit it. Returns true on success.',
  })
  async uninstallMnPlugin(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    await this.assertAdmin(user);
    const row = await this.db.mnPlugin.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`plugin ${id} not found`);
    try {
      await this.runtime.disable(id);
    } catch {
      // Already not running — fine.
    }
    await this.db.mnPlugin.delete({ where: { id } });
    return true;
  }

  // -------------------------------------------------------------------------
  // M6b — per-workspace plugin configs (enable/disable scoped to a workspace).
  //
  // Workspace members may read + upsert configs for their own workspace; the
  // AccessController fence handles that — no admin check. Cross-workspace
  // writes are blocked by `Workspace.Read` / `Workspace.Settings.Update`
  // assertions, not by a free-form workspaceId comparison.
  // -------------------------------------------------------------------------

  @Query(() => [MnPluginConfigObjectType], {
    description:
      'List the per-workspace plugin configs visible to this workspace. ' +
      'Returns every installed plugin once — synthesises an empty config row ' +
      'for plugins the workspace has not yet configured so the UI can render ' +
      'an "enable" toggle for them.',
  })
  async mnPluginConfigs(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnPluginConfigObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const rows = await this.configService.listForWorkspace(workspaceId);
    return rows.map(toPluginConfigObjectType);
  }

  @Mutation(() => MnPluginConfigObjectType, {
    description:
      'Create or update the workspace-scoped (or project-scoped) plugin ' +
      'config row. The well-known `configJson.enabled` boolean is what the ' +
      'workspace UI toggle flips; other fields are passed through to plugin ' +
      'workers via the host RPC bridge. 16 KB hard cap on payload size.',
  })
  async upsertMnPluginConfig(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => UpsertMnPluginConfigInput })
    input: UpsertMnPluginConfigInput
  ): Promise<MnPluginConfigObjectType> {
    const values = UpsertMnPluginConfigSchema.parse(input);
    await this.ac
      .user(user.id)
      .workspace(values.workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.configService.upsert(values);
    return toPluginConfigObjectType(row);
  }

  private async assertAdmin(user: CurrentUser): Promise<void> {
    const features = await this.db.userFeature.findMany({
      where: { userId: user.id, activated: true },
      select: { name: true },
    });
    const isAdmin = features.some(
      f => f.name === 'administrator' || f.name === 'admin'
    );
    if (!isAdmin) {
      throw new ForbiddenException(
        'mnPlugin mutations require instance-administrator'
      );
    }
  }
}

interface PluginRow {
  id: string;
  name: string;
  version: string;
  manifestJson: unknown;
  packagePath: string | null;
  processStatus: MnPluginObjectType['processStatus'];
  enabledAt: Date | null;
  installedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function toObjectType(row: PluginRow): MnPluginObjectType {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    manifestJson: row.manifestJson,
    packagePath: row.packagePath,
    processStatus: row.processStatus,
    enabledAt: row.enabledAt,
    installedAt: row.installedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

interface PluginConfigRow {
  id: string;
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function toPluginConfigObjectType(
  row: PluginConfigRow
): MnPluginConfigObjectType {
  return {
    id: row.id,
    pluginId: row.pluginId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    configJson: row.configJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
