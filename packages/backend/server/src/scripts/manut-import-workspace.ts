#!/usr/bin/env tsx
/**
 * M5.2 / M5.3 — Workspace portability import CLI.
 *
 * Usage:
 *
 *   yarn manut:import-workspace <archive>
 *
 * Reads a `manut-export-*.tar.gz` archive produced by
 * `manut-export-workspace.ts`, creates a NEW Workspace row, and
 * populates it with the agents / skills / goals described in
 * manifest.json + AGENTS.md.
 *
 * Scrubbed secrets in `adapterConfig` / `runtimeConfig` are preserved
 * verbatim as the SCRUBBED placeholder; the operator must reconstruct
 * them post-import (typically by re-entering credentials via the
 * workspace settings UI or by rerunning the OAuth flow).
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { PrismaClient } from '@prisma/client';
import * as tar from 'tar';

import type { ExportManifest } from '../plugins/manut/manut-portability.service';
import { MnPortabilityService } from '../plugins/manut/manut-portability.service';

async function main(): Promise<void> {
  const archive = process.argv[2];
  if (!archive) {
    process.stderr.write('usage: manut-import-workspace <archive>\n');
    process.exit(2);
  }
  if (!existsSync(archive)) {
    process.stderr.write(`archive not found: ${archive}\n`);
    process.exit(2);
  }

  const stagingDir = mkdtempSync(join(tmpdir(), 'manut-import-'));
  const db = new PrismaClient();
  try {
    await mkdir(stagingDir, { recursive: true });
    await tar.extract({ file: archive, cwd: stagingDir });

    const manifestPath = join(stagingDir, 'manifest.json');
    const agentsMdPath = join(stagingDir, 'AGENTS.md');
    if (!existsSync(manifestPath) || !existsSync(agentsMdPath)) {
      throw new Error(
        'archive is missing manifest.json or AGENTS.md — not a manut export?'
      );
    }
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8')
    ) as ExportManifest;
    const agentsMd = readFileSync(agentsMdPath, 'utf8');

    const skills: Array<{ slug: string; body: string }> = [];
    const skillsDir = join(stagingDir, 'skills');
    if (existsSync(skillsDir)) {
      const entries = await readdir(skillsDir);
      for (const entry of entries) {
        if (!entry.endsWith('.md')) continue;
        const slug = entry.slice(0, -3);
        const body = readFileSync(join(skillsDir, entry), 'utf8');
        skills.push({ slug, body });
      }
    }

    const newWorkspaceId = randomUUID();
    const slug = `imported-${newWorkspaceId.slice(0, 8)}`;
    await db.workspace.create({
      data: {
        id: newWorkspaceId,
        slug,
        public: false,
        name: `Imported (${slug})`,
      },
    });

    const portability = new MnPortabilityService(db);
    const result = await portability.importFromManifest(newWorkspaceId, {
      manifest,
      agentsMd,
      skills,
    });

    process.stdout.write(
      `Imported into workspace ${newWorkspaceId}: ${result.agentsCreated} agents, ` +
        `${result.skillsCreated} skills, ${result.goalsCreated} goals\n`
    );
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
    await db.$disconnect();
  }
}

main().catch(err => {
  process.stderr.write(`manut-import-workspace failed: ${String(err)}\n`);
  process.exit(1);
});
