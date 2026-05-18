#!/usr/bin/env tsx
/**
 * M5.2 / M5.3 — Workspace portability export CLI.
 *
 * Usage:
 *
 *   yarn manut:export-workspace <workspaceId>
 *
 * Produces `manut-export-<workspaceId>-<ISO-timestamp>.tar.gz` in the
 * current working directory containing:
 *
 *   manifest.json          — the structured ExportManifest
 *   AGENTS.md              — the human-readable Markdown view
 *   skills/<slug>.md       — one file per skill body
 *   settings.json          — export metadata (SHA, timestamp, version)
 *
 * Persists a row in MnExportSnapshot keyed by the manifest SHA so the
 * export shows up in the workspaces export history UI.
 *
 * IMPORTANT: this is a CLI entry point. It instantiates Prisma + the
 * portability service directly, NOT through NestJS DI, so it can run
 * outside the API server (cron, ad-hoc ops, CI verification).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line import-x/no-extraneous-dependencies
import * as tar from 'tar';

import { MnExportSnapshotService } from '../plugins/manut/manut-export-snapshot.service';
import { MnPortabilityService } from '../plugins/manut/manut-portability.service';

async function main(): Promise<void> {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    process.stderr.write('usage: manut-export-workspace <workspaceId>\n');
    process.exit(2);
  }

  const db = new PrismaClient();
  try {
    const portability = new MnPortabilityService(db);
    const snapshots = new MnExportSnapshotService(db);

    const { manifest, agentsMd, skills, sha256 } =
      await portability.exportToManifest(workspaceId);

    const isoStamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_');
    const archiveName = `manut-export-${workspaceId}-${isoStamp}.tar.gz`;
    const archivePath = join(process.cwd(), archiveName);

    const stagingDir = mkdtempSync(join(tmpdir(), 'manut-export-'));
    try {
      writeFileSync(
        join(stagingDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
      );
      writeFileSync(join(stagingDir, 'AGENTS.md'), agentsMd, 'utf8');
      writeFileSync(
        join(stagingDir, 'settings.json'),
        JSON.stringify(
          {
            version: 'manut-portability-v1',
            workspaceId,
            exportedAt: new Date().toISOString(),
            sha256,
          },
          null,
          2
        ),
        'utf8'
      );

      await mkdir(join(stagingDir, 'skills'), { recursive: true });
      for (const skill of skills) {
        writeFileSync(
          join(stagingDir, 'skills', `${skill.slug}.md`),
          skill.body,
          'utf8'
        );
      }

      await tar.create(
        {
          gzip: true,
          file: archivePath,
          cwd: stagingDir,
          portable: true,
        },
        [
          'manifest.json',
          'AGENTS.md',
          'settings.json',
          ...skills.map(s => `skills/${s.slug}.md`),
        ]
      );

      // Persist a snapshot row. The payload that defines the SHA is
      // the canonical manifest+agentsMd+skills triple — NOT the tar
      // bytes, which include timestamps and would defeat idempotency.
      const archiveBytes = readFileSync(archivePath);
      await snapshots.create({
        workspaceId,
        createdByUserId: null,
        manifest: manifest as unknown as Parameters<
          typeof snapshots.create
        >[0]['manifest'],
        payload: sha256,
        payloadBlobKey: archiveName,
      });

      process.stdout.write(
        `Wrote ${archivePath} (${archiveBytes.byteLength} bytes, sha256=${sha256})\n`
      );
    } finally {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch(err => {
  process.stderr.write(`manut-export-workspace failed: ${String(err)}\n`);
  process.exit(1);
});
