import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';

import { type PluginManifest, PluginManifestSchema } from '@manut/plugin-sdk';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { MnPlugin, Prisma } from '@prisma/client';
import { MnPluginStatus, PrismaClient } from '@prisma/client';

/**
 * Runtime installer for Manut plugins.
 *
 * - Resolves a package name + version into an on-disk path under the
 *   instance plugin directory (default: `<cwd>/.manut/plugins/<name>`)
 * - Runs `npm install <name>@<version>` inside that directory
 * - Reads + validates the resulting `package.json` -> `manut` field
 *   as a `PluginManifest`
 * - Refuses to register a manifest whose API routes shadow core paths
 *   (`/api/workspaces`, `/api/graphql`, `/api/auth`, etc.) — every
 *   plugin route is mounted under `/api/plugins/:pluginId/api/...`
 *   but the installer also blocks misleading internal paths
 * - Persists the row to `MnPlugin`
 *
 * `@Injectable()` + RUNTIME `PrismaClient` per the v1.12.0 DI scar.
 */
@Injectable()
export class ManutPluginInstallerService {
  private readonly pluginsRoot: string;

  /**
   * Core paths the installer refuses to let any plugin route declare,
   * even though every plugin route is namespaced under
   * `/api/plugins/:pluginId/api/...`. Defence in depth — if the mount
   * point regresses, the plugin manifest still cannot collide.
   */
  private readonly bannedPathPrefixes = [
    '/api/workspaces',
    '/api/graphql',
    '/api/auth',
    '/api/admin',
    '/api/server',
    '/api/copilot',
    '/oauth',
  ];

  constructor(private readonly db: PrismaClient) {
    this.pluginsRoot =
      process.env.MANUT_PLUGIN_ROOT ?? join(process.cwd(), '.manut', 'plugins');
  }

  /**
   * Install a plugin from npm into the instance plugin directory.
   * Returns the persisted `MnPlugin` row.
   */
  async install(input: { name: string; version: string }): Promise<MnPlugin> {
    const targetDir = join(this.pluginsRoot, sanitiseDirSegment(input.name));
    await mkdir(targetDir, { recursive: true });

    // Use npm CLI directly so we inherit npm's package resolution,
    // shrinkwrap, and integrity checks. The plugin install lives in
    // its own directory so a broken plugin can never poison the host
    // workspace's lockfile.
    const args = ['install', `${input.name}@${input.version}`, '--no-audit'];
    await this.runNpm(targetDir, args);

    const manifest = await this.loadManifestFromDir(targetDir, input.name);
    this.assertNoCorePathCollision(manifest);

    const existing = await this.db.mnPlugin.findUnique({
      where: { name: input.name },
    });
    const manifestJson = JSON.parse(
      JSON.stringify(manifest)
    ) as Prisma.InputJsonValue;
    if (existing) {
      return await this.db.mnPlugin.update({
        where: { name: input.name },
        data: {
          version: manifest.version,
          manifestJson,
          packagePath: targetDir,
          processStatus: MnPluginStatus.INSTALLED,
          updatedAt: new Date(),
        },
      });
    }
    return await this.db.mnPlugin.create({
      data: {
        name: input.name,
        version: manifest.version,
        manifestJson,
        packagePath: targetDir,
        processStatus: MnPluginStatus.INSTALLED,
      },
    });
  }

  /**
   * Re-validate a manifest already persisted in the DB. The runtime
   * calls this before spawning a worker so a corrupted row never
   * reaches `child_process.fork`.
   */
  validateManifest(raw: unknown): PluginManifest {
    return PluginManifestSchema.parse(raw);
  }

  /**
   * Reject manifests whose declared API routes collide with reserved
   * host prefixes. Mount-time scoping prevents accidental shadowing,
   * but rejecting at install time gives operators a clear error rather
   * than a silent no-op route.
   */
  private assertNoCorePathCollision(manifest: PluginManifest): void {
    for (const route of manifest.apiRoutes) {
      for (const banned of this.bannedPathPrefixes) {
        if (route.path.startsWith(banned)) {
          throw new BadRequestException(
            `plugin '${manifest.name}' declares route ${route.method} ${route.path} ` +
              `which shadows reserved core path '${banned}'`
          );
        }
      }
    }
  }

  private async loadManifestFromDir(
    dir: string,
    pkgName: string
  ): Promise<PluginManifest> {
    // The installed package lives under `node_modules/<pkgName>` inside
    // the per-plugin dir. Different package managers (pnpm, yarn berry)
    // hoist differently, but npm + the per-plugin `node_modules` layout
    // is the contract.
    const pkgJsonPath = join(dir, 'node_modules', pkgName, 'package.json');
    if (!existsSync(pkgJsonPath)) {
      throw new BadRequestException(
        `plugin install did not produce ${pkgJsonPath}`
      );
    }
    const raw = await readFile(pkgJsonPath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err: unknown) {
      throw new BadRequestException(
        `plugin package.json is not valid JSON: ${getErrorMessage(err)}`
      );
    }
    if (typeof parsed !== 'object' || parsed === null || !('manut' in parsed)) {
      throw new BadRequestException(
        `plugin package.json is missing 'manut' manifest block`
      );
    }
    const manifestRaw = (parsed as { manut: unknown }).manut;
    return PluginManifestSchema.parse(manifestRaw);
  }

  private async runNpm(cwd: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('npm', args, {
        cwd,
        stdio: 'pipe',
        env: process.env,
      });
      let stderr = '';
      proc.stderr?.on('data', chunk => {
        stderr += String(chunk);
      });
      proc.on('error', err => reject(err));
      proc.on('exit', code => {
        if (code === 0) return resolve();
        reject(
          new BadRequestException(
            `npm exited with code ${code}: ${stderr.slice(0, 500)}`
          )
        );
      });
    });
  }

  /** Test hook — the configured plugin root. */
  get rootDir(): string {
    return this.pluginsRoot;
  }

  /**
   * Synchronous accessor used by the runtime service to derive the
   * entry-point path for an already-installed plugin without going
   * through the DB row a second time.
   */
  resolveEntrypoint(packagePath: string, pkgName: string): string {
    return resolvePath(packagePath, 'node_modules', pkgName);
  }

  /** Test hook so specs can inspect the raw banned-prefix list. */
  get reservedPaths(): readonly string[] {
    return this.bannedPathPrefixes;
  }

  /** Test hook: pre-parse a manifest without going through npm. */
  parseManifest(raw: string): PluginManifest {
    return PluginManifestSchema.parse(JSON.parse(raw));
  }

  /** Read raw file once at boot for telemetry/diagnostics. */
  readPackageJsonSafely(path: string): string | null {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  }
}

function sanitiseDirSegment(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]/g, '_');
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
