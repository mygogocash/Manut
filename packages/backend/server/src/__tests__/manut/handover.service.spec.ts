import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException } from '@nestjs/common';
import test from 'ava';

import { parseAndRenderManutHandover } from '../../plugins/manut/manut-handover.service';

const manutDir = join(process.cwd(), 'src/plugins/manut');
const repoRoot = join(process.cwd(), '../../..');
const dtoFiles = [
  'manut.dto.ts',
  'manut-pm.dto.ts',
  'manut-crm.dto.ts',
  'manut-reminder.dto.ts',
  'manut-handover.resolver.ts',
];

function handover(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-05-09T12:00:00.000Z',
    controlPlane: {
      source: 'docs/SUPERFLOW_CONTROL_PLANE.md',
      company: 'GoGoCash Manut',
      goal: 'Ship verified AI-assisted AFFiNE work.',
    },
    workflow: {
      mode: 'release',
      status: 'release image built',
      repository: 'mygogocash/Manut',
      ref: 'v1.2.3',
      actor: 'codex',
      runId: '12345',
      runUrl: 'https://github.com/mygogocash/Manut/actions/runs/12345',
    },
    release: {
      version: 'v1.2.3',
      shortSha: 'abc123',
      headSha: 'abc123def456',
      imageTag: 'v1.2.3',
      imageDigest: 'sha256:abc',
      image:
        'asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:v1.2.3',
      registry:
        'asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash',
      deployUrl: 'https://manut.gogocash.co',
    },
    agents: [
      {
        role: 'Verifier',
        adapter: 'CI checks',
        responsibility: 'Attach evidence before release.',
      },
    ],
    taskTree: ['Build fresh artifacts.', 'Package immutable image tag.'],
    verificationGates: ['server bundle rebuilt', 'post-swap /info passes'],
    rollback: {
      workflow: 'manut-rollback.yml',
      vmSnapshot: '/srv/affine/compose/compose.yml.previous.bak',
    },
    ...overrides,
  });
}

test('Manut handover JSON renders title and markdown', t => {
  const result = parseAndRenderManutHandover(handover());

  t.is(result.title, 'Manut Release Handover - v1.2.3');
  t.true(result.markdown.includes('Status: release image built'));
  t.true(result.markdown.includes('| Version | v1.2.3 |'));
  t.true(result.markdown.includes('| Verifier | CI checks |'));
  t.true(result.markdown.includes('1. Build fresh artifacts.'));
  t.true(result.markdown.includes('- Workflow: manut-rollback.yml'));
});

test('Manut handover parser accepts generated CI JSON contract', t => {
  const tmp = mkdtempSync(join(tmpdir(), 'manut-handover-'));

  try {
    const jsonPath = join(tmp, 'handover.json');
    const markdownPath = join(tmp, 'handover.md');

    execFileSync(
      process.execPath,
      [
        join(repoRoot, 'scripts/manut-release-handover.mjs'),
        '--mode',
        'release',
        '--status',
        'release image built',
        '--version',
        'v9.9.9',
        '--image-tag',
        'v9.9.9',
        '--short-sha',
        'abc123',
        '--head-sha',
        'abc123def456',
        '--json-output',
        jsonPath,
        '--output',
        markdownPath,
        '--generated-at',
        '2026-05-09T12:00:00.000Z',
      ],
      { stdio: 'ignore' }
    );

    const result = parseAndRenderManutHandover(readFileSync(jsonPath, 'utf8'));

    t.is(result.title, 'Manut Release Handover - v9.9.9');
    t.true(result.markdown.includes('Status: release image built'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('Manut handover rejects unsupported schemaVersion', t => {
  const error = t.throws(() =>
    parseAndRenderManutHandover(handover({ schemaVersion: 2 }))
  );

  t.true(error instanceof BadRequestException);
  t.regex(error.message, /schemaVersion/);
});

test('Manut handover rejects malformed JSON', t => {
  const error = t.throws(() => parseAndRenderManutHandover('{nope'));

  t.true(error instanceof BadRequestException);
  t.regex(error.message, /valid JSON/);
});

test('Manut handover caps high-cardinality arrays', t => {
  const error = t.throws(() =>
    parseAndRenderManutHandover(
      handover({ verificationGates: Array.from({ length: 51 }, () => 'gate') })
    )
  );

  t.true(error instanceof BadRequestException);
  t.regex(error.message, /too many items/);
});

test('Manut handover GraphQL nullable DTO fields use explicit types', t => {
  for (const file of dtoFiles) {
    const source = readFileSync(join(manutDir, file), 'utf8');

    t.false(
      /@Field\(\{\s*nullable:\s*true/.test(source),
      `${file}: nullable @Field decorators must use @Field(() => Type, { nullable: true })`
    );
  }
});

test('Manut handover wraps https runUrl as a Markdown link', t => {
  const result = parseAndRenderManutHandover(
    handover({
      workflow: {
        mode: 'release',
        status: 'release image built',
        repository: 'mygogocash/Manut',
        ref: 'v1.2.3',
        actor: 'codex',
        runId: '12345',
        runUrl: 'https://example.com/runs/1',
      },
    })
  );

  t.true(
    result.markdown.includes(
      '| Run URL | [https://example.com/runs/1](https://example.com/runs/1) |'
    )
  );
});

test('Manut handover wraps http runUrl as a Markdown link', t => {
  const result = parseAndRenderManutHandover(
    handover({
      workflow: {
        mode: 'release',
        status: 'release image built',
        repository: 'mygogocash/Manut',
        ref: 'v1.2.3',
        actor: 'codex',
        runId: '12345',
        runUrl: 'http://example.com/runs/1',
      },
    })
  );

  t.true(
    result.markdown.includes(
      '| Run URL | [http://example.com/runs/1](http://example.com/runs/1) |'
    )
  );
});

test('Manut handover renders javascript: scheme runUrl as plain text', t => {
  const result = parseAndRenderManutHandover(
    handover({
      workflow: {
        mode: 'release',
        status: 'release image built',
        repository: 'mygogocash/Manut',
        ref: 'v1.2.3',
        actor: 'codex',
        runId: '12345',
        runUrl: 'javascript:alert(1)',
      },
    })
  );

  // Plain text, no Markdown link syntax.
  t.true(result.markdown.includes('| Run URL | javascript:alert(1) |'));
  t.false(result.markdown.includes('[javascript:alert(1)]'));
  t.false(result.markdown.includes('(javascript:alert(1))'));
});

test('Manut handover renders file: scheme runUrl as plain text', t => {
  const result = parseAndRenderManutHandover(
    handover({
      workflow: {
        mode: 'release',
        status: 'release image built',
        repository: 'mygogocash/Manut',
        ref: 'v1.2.3',
        actor: 'codex',
        runId: '12345',
        runUrl: 'file:///etc/passwd',
      },
    })
  );

  t.true(result.markdown.includes('| Run URL | file:///etc/passwd |'));
  t.false(result.markdown.includes('[file:///etc/passwd]'));
});

test('Manut handover renders schemeless runUrl as plain text', t => {
  const result = parseAndRenderManutHandover(
    handover({
      workflow: {
        mode: 'release',
        status: 'release image built',
        repository: 'mygogocash/Manut',
        ref: 'v1.2.3',
        actor: 'codex',
        runId: '12345',
        runUrl: 'not-a-url',
      },
    })
  );

  t.true(result.markdown.includes('| Run URL | not-a-url |'));
  t.false(result.markdown.includes('[not-a-url]'));
});

test('Manut handover strips closing brackets from link display text', t => {
  // A crafted URL that would let a "]" close the Markdown link's display
  // segment early. Even though only https?:// URLs are linkified, we
  // strip "]" from the display text on every branch so it can't break
  // Markdown link syntax or smuggle a trailing payload.
  const result = parseAndRenderManutHandover(
    handover({
      workflow: {
        mode: 'release',
        status: 'release image built',
        repository: 'mygogocash/Manut',
        ref: 'v1.2.3',
        actor: 'codex',
        runId: '12345',
        runUrl: 'https://example.com/]injected',
      },
    })
  );

  // The display segment must not contain a raw "]" that would close the
  // link early.
  t.false(result.markdown.includes('[https://example.com/]'));
  // The URL itself is preserved inside the parentheses.
  t.true(result.markdown.includes('(https://example.com/]injected)'));
});
