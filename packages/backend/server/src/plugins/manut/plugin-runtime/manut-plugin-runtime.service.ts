import { fork } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { type PluginCapability, type PluginManifest } from '@manut/plugin-sdk';
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { MnPlugin } from '@prisma/client';
import { MnPluginStatus, PrismaClient } from '@prisma/client';

import { ManutPluginHostRpcService } from './manut-plugin-host-rpc.service';
import { ManutPluginInstallerService } from './manut-plugin-installer.service';
import {
  ManutPluginRpcBridge,
  type RpcTransport,
} from './manut-plugin-rpc-bridge';
import { ManutPluginSupervisorService } from './manut-plugin-supervisor.service';

/**
 * Out-of-process plugin runtime.
 *
 * Lifecycle:
 *   1. `onModuleInit` reads every `MnPlugin` row where status is
 *      `RUNNING` (the last shutdown was clean) OR `LOADING` (we
 *      crashed mid-spawn) and re-spawns each via `child_process.fork`
 *   2. For each spawned worker we register a JSON-RPC bridge over
 *      Node IPC (the `process.send` channel `fork` opens by default)
 *   3. Each bridge has its incoming-request handler set to
 *      `ManutPluginHostRpcService.dispatch` which capability-gates
 *      every call against the plugin's manifest
 *   4. Worker exit triggers `ManutPluginSupervisorService.recordCrash`
 *      which decides backoff or `park` (mark CRASHED in DB)
 *
 * Host API version compatibility is checked at spawn — major
 * mismatches refuse to load so an operator must reinstall after a
 * host upgrade.
 *
 * `@Injectable()` + RUNTIME `PrismaClient` per the v1.12.0 DI scar.
 */
@Injectable()
export class ManutPluginRuntimeService
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly HOST_API_VERSION_MAJOR = 1;

  private readonly logger = new Logger(ManutPluginRuntimeService.name);
  private readonly active = new Map<string, ActivePlugin>();
  private disposed = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly hostRpc: ManutPluginHostRpcService,
    private readonly installer: ManutPluginInstallerService,
    private readonly supervisor: ManutPluginSupervisorService
  ) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.db.mnPlugin.findMany({
      where: {
        OR: [
          { processStatus: MnPluginStatus.RUNNING },
          { processStatus: MnPluginStatus.LOADING },
        ],
      },
    });
    for (const row of rows) {
      try {
        await this.spawn(row);
      } catch (err: unknown) {
        this.logger.error(
          `failed to spawn plugin ${row.name}: ${getErrorMessage(err)}`
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.disposed = true;
    for (const [pluginId, active] of this.active) {
      try {
        active.bridge.dispose('module destroy');
        active.transport.kill('SIGTERM');
      } catch (err: unknown) {
        this.logger.warn(
          `error tearing down plugin ${pluginId}: ${getErrorMessage(err)}`
        );
      }
    }
    this.active.clear();
  }

  /**
   * Used by the resolver to mark a plugin enabled and spawn its worker
   * in the same step. Idempotent — calling on an already-running
   * plugin is a no-op.
   */
  async enable(pluginId: string): Promise<MnPlugin> {
    const row = await this.requireRow(pluginId);
    if (this.active.has(pluginId)) {
      return row;
    }
    const updated = await this.db.mnPlugin.update({
      where: { id: pluginId },
      data: {
        processStatus: MnPluginStatus.LOADING,
        enabledAt: row.enabledAt ?? new Date(),
      },
    });
    await this.spawn(updated);
    return updated;
  }

  async disable(pluginId: string): Promise<MnPlugin> {
    // Tear down regardless of whether the DB row still exists — the
    // uninstall path deletes the row AFTER calling disable.
    await this.requireRow(pluginId);
    const active = this.active.get(pluginId);
    if (active) {
      active.bridge.dispose('disable');
      active.transport.kill('SIGTERM');
      this.active.delete(pluginId);
    }
    this.supervisor.clear(pluginId);
    return await this.db.mnPlugin.update({
      where: { id: pluginId },
      data: { processStatus: MnPluginStatus.DISABLED },
    });
  }

  /**
   * Route a tool call to the plugin worker. The runtime keeps the
   * caller's identity opaque to the plugin — only the input payload
   * crosses the boundary.
   */
  async callTool(input: {
    pluginId: string;
    name: string;
    input: unknown;
  }): Promise<unknown> {
    const active = this.requireActive(input.pluginId);
    return await active.bridge.call('tool.call', {
      name: input.name,
      input: input.input,
    });
  }

  /**
   * Route an HTTP request to the plugin worker. Called by the
   * `/api/plugins/:pluginId/api/*` controller.
   */
  async callRoute(input: {
    pluginId: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  }): Promise<unknown> {
    const active = this.requireActive(input.pluginId);
    return await active.bridge.call('route.call', {
      method: input.method,
      path: input.path,
      headers: input.headers,
      body: input.body,
    });
  }

  /** Test hook: expose the active map (read-only) for spec assertions. */
  getActiveSnapshot(): ReadonlyMap<string, ReadonlyActivePlugin> {
    const snapshot = new Map<string, ReadonlyActivePlugin>();
    for (const [id, value] of this.active) {
      snapshot.set(id, {
        pluginId: id,
        manifest: value.manifest,
        startedAt: value.startedAt,
      });
    }
    return snapshot;
  }

  /**
   * Test hook: inject a pre-fabricated transport so specs can simulate
   * crash + restart without forking a real process. Production code
   * never calls this.
   */
  async attachTransportForTest(
    row: MnPlugin,
    transport: RpcTransport,
    manifest: PluginManifest
  ): Promise<void> {
    this.wireTransport(row, transport, manifest);
  }

  private async spawn(row: MnPlugin): Promise<void> {
    if (this.disposed) return;
    let manifest: PluginManifest;
    try {
      manifest = this.installer.validateManifest(row.manifestJson);
    } catch (err: unknown) {
      this.logger.error(
        `manifest for ${row.name} is invalid: ${getErrorMessage(err)}; parking`
      );
      await this.markCrashed(row.id);
      return;
    }
    if (!this.isCompatibleHostApi(manifest)) {
      this.logger.error(
        `plugin ${row.name} targets hostApiVersion=${manifest.hostApiVersion} but host major=${ManutPluginRuntimeService.HOST_API_VERSION_MAJOR}`
      );
      await this.markCrashed(row.id);
      return;
    }
    if (!row.packagePath) {
      this.logger.error(`plugin ${row.name} has no packagePath; parking`);
      await this.markCrashed(row.id);
      return;
    }

    const entrypoint = join(
      this.installer.resolveEntrypoint(row.packagePath, manifest.name),
      'dist',
      'worker.js'
    );

    const child = fork(entrypoint, [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        MANUT_PLUGIN_ID: row.id,
        MANUT_PLUGIN_NAME: manifest.name,
      },
    });

    this.wireTransport(row, child as unknown as RpcTransport, manifest);
  }

  private wireTransport(
    row: MnPlugin,
    transport: RpcTransport,
    manifest: PluginManifest
  ): void {
    const bridge = new ManutPluginRpcBridge(transport, {
      log: (event, data) =>
        this.logger.debug(`[${row.name}] ${event} ${JSON.stringify(data)}`),
    });
    const grantedCapabilities: ReadonlyArray<PluginCapability> =
      manifest.capabilities;
    bridge.setIncomingHandler(async (method, params) => {
      return await this.hostRpc.dispatch(method, params, grantedCapabilities);
    });

    const startedAt = new Date();
    this.active.set(row.id, {
      transport,
      bridge,
      manifest,
      row,
      startedAt,
    });

    transport.on('exit', (code: unknown) => {
      this.handleExit(row, manifest, Number(code ?? 1)).catch(err =>
        this.logger.error(
          `error handling exit for ${row.name}: ${getErrorMessage(err)}`
        )
      );
    });
    transport.on('error', (err: unknown) => {
      this.logger.warn(
        `[${row.name}] transport error: ${getErrorMessage(err)}`
      );
    });

    this.markRunning(row.id).catch(err => {
      this.logger.warn(
        `[${row.name}] markRunning failed: ${getErrorMessage(err)}`
      );
    });
  }

  private async handleExit(
    row: MnPlugin,
    _manifest: PluginManifest,
    code: number
  ): Promise<void> {
    if (this.disposed) return;
    const active = this.active.get(row.id);
    if (!active) return;
    active.bridge.dispose(`process exit code=${code}`);
    this.active.delete(row.id);

    const decision = this.supervisor.recordCrash(row.id);
    if (decision.decision === 'park') {
      await this.markCrashed(row.id);
      return;
    }

    this.logger.warn(
      `restarting plugin ${row.name} in ${decision.delayMs}ms (exit=${code})`
    );
    await delay(decision.delayMs);
    if (this.disposed) return;
    const fresh = await this.db.mnPlugin.findUnique({ where: { id: row.id } });
    if (!fresh || fresh.processStatus === MnPluginStatus.DISABLED) return;
    await this.spawn(fresh);
  }

  private async markRunning(id: string): Promise<void> {
    try {
      await this.db.mnPlugin.update({
        where: { id },
        data: { processStatus: MnPluginStatus.RUNNING },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `failed to mark plugin ${id} RUNNING: ${getErrorMessage(err)}`
      );
    }
  }

  private async markCrashed(id: string): Promise<void> {
    try {
      await this.db.mnPlugin.update({
        where: { id },
        data: { processStatus: MnPluginStatus.CRASHED },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `failed to mark plugin ${id} CRASHED: ${getErrorMessage(err)}`
      );
    }
  }

  private isCompatibleHostApi(manifest: PluginManifest): boolean {
    const majorPart = manifest.hostApiVersion.split('.')[0] ?? '0';
    const major = Number.parseInt(majorPart, 10);
    return major === ManutPluginRuntimeService.HOST_API_VERSION_MAJOR;
  }

  private async requireRow(pluginId: string): Promise<MnPlugin> {
    const row = await this.db.mnPlugin.findUnique({ where: { id: pluginId } });
    if (!row) {
      throw new Error(`plugin ${pluginId} not found`);
    }
    return row;
  }

  private requireActive(pluginId: string): ActivePlugin {
    const active = this.active.get(pluginId);
    if (!active) {
      throw new Error(`plugin ${pluginId} is not active`);
    }
    return active;
  }
}

interface ActivePlugin {
  transport: RpcTransport;
  bridge: ManutPluginRpcBridge;
  manifest: PluginManifest;
  row: MnPlugin;
  startedAt: Date;
}

interface ReadonlyActivePlugin {
  pluginId: string;
  manifest: PluginManifest;
  startedAt: Date;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
