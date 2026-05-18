import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import {
  MN_PLUGIN_CONFIG_MAX_BYTES,
  type UpsertMnPluginConfigValues,
} from './manut-plugin.dto';

/**
 * M6b per-workspace plugin config service.
 *
 * Extracted from the resolver so the workspace-fence + size-cap + upsert
 * logic can be unit-tested without dragging in `core/auth` (which
 * transitively pulls the napi binary — fine in dev, but the binary is
 * gitignored and not present in all developer workspaces).
 *
 * Resolver layer maps `CurrentUser` → `AccessController.assert(...)` BEFORE
 * calling into this service, so the service trusts the workspaceId
 * argument as already-authorised.
 *
 * `@Injectable()` + runtime `PrismaClient` per the v1.12.0 DI scar
 * (CLAUDE.md §6) — never `import type` for DI targets.
 */
@Injectable()
export class ManutPluginConfigService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * List the per-workspace config rows for a workspace. Synthesises a
   * virtual row for each installed plugin that has no workspace-default
   * config yet so the UI gets a uniform list with an enable toggle for
   * every plugin.
   */
  async listForWorkspace(workspaceId: string): Promise<PluginConfigResult[]> {
    const plugins = await this.db.mnPlugin.findMany({
      orderBy: { installedAt: 'desc' },
    });
    const existing = await this.db.mnPluginConfig.findMany({
      where: { workspaceId },
    });
    const byPluginId = new Map<string, (typeof existing)[number]>();
    for (const cfg of existing) {
      // Only workspace-default rows (projectId === null) are the toggle
      // row; project-scoped overrides live alongside but don't replace
      // the workspace-level "enabled" boolean.
      if (cfg.projectId === null) {
        byPluginId.set(cfg.pluginId, cfg);
      }
    }

    return plugins.map(plugin => {
      const cfg = byPluginId.get(plugin.id);
      if (cfg) {
        return {
          id: cfg.id,
          pluginId: cfg.pluginId,
          workspaceId: cfg.workspaceId,
          projectId: cfg.projectId,
          configJson: cfg.configJson,
          createdAt: cfg.createdAt,
          updatedAt: cfg.updatedAt,
        };
      }
      return {
        id: `virtual:${plugin.id}`,
        pluginId: plugin.id,
        workspaceId,
        projectId: null,
        configJson: { enabled: false },
        createdAt: plugin.installedAt,
        updatedAt: plugin.installedAt,
      };
    });
  }

  /**
   * Create or update the workspace-scoped (or project-scoped) plugin
   * config row. 16 KB hard cap on serialised payload; the plugin must
   * exist; the workspaceId is trusted as already-authorised.
   */
  async upsert(
    values: UpsertMnPluginConfigValues
  ): Promise<PluginConfigResult> {
    const serialised = JSON.stringify(values.configJson);
    if (Buffer.byteLength(serialised, 'utf8') > MN_PLUGIN_CONFIG_MAX_BYTES) {
      throw new BadRequestException(
        `plugin configJson exceeds ${MN_PLUGIN_CONFIG_MAX_BYTES} bytes`
      );
    }

    const plugin = await this.db.mnPlugin.findUnique({
      where: { id: values.pluginId },
    });
    if (!plugin) {
      throw new NotFoundException(`plugin ${values.pluginId} not found`);
    }

    // Prisma's generated compound-unique-input for
    // `pluginId_workspaceId_projectId` types `projectId: string` (not
    // nullable), because Postgres treats NULL as distinct in unique
    // constraints. We use findFirst → update/create to keep the
    // workspace-default row (projectId IS NULL) unambiguous on the
    // application side, which matches the @@unique semantics of the
    // schema for NULL.
    const projectId = values.projectId ?? null;
    const existing = await this.db.mnPluginConfig.findFirst({
      where: {
        pluginId: values.pluginId,
        workspaceId: values.workspaceId,
        projectId,
      },
    });

    const row = existing
      ? await this.db.mnPluginConfig.update({
          where: { id: existing.id },
          data: { configJson: values.configJson as never },
        })
      : await this.db.mnPluginConfig.create({
          data: {
            pluginId: values.pluginId,
            workspaceId: values.workspaceId,
            projectId,
            configJson: values.configJson as never,
          },
        });

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
}

export interface PluginConfigResult {
  id: string;
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}
