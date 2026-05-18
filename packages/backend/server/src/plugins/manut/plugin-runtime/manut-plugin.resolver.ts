import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../../core/auth';
import {
  InstallMnPluginInput,
  InstallPluginSchema,
  MnPluginObjectType,
} from './manut-plugin.dto';
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
    private readonly runtime: ManutPluginRuntimeService
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
