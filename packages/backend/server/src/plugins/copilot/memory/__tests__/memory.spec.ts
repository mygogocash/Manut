import test from 'ava';
import Sinon from 'sinon';

import { MemoryEmbedService } from '../embed.service.js';
import { MemoryIngestService } from '../ingest.service.js';
import { MemoryRetrieveService } from '../retrieve.service.js';
import { formatMemoriesForPrompt } from '../system-prompt.js';
import type { RetrievedMemory } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a 1024-dim float vector with a single non-zero slot. Used so
 * tests can reason about "which query is closest to which row" without
 * needing real Vertex embeddings.
 */
function vec(seed: number): number[] {
  const out = Array.from<number>({ length: 1024 }).fill(0);
  out[seed % 1024] = 1;
  return out;
}

function fakeEmbedService(map: Record<string, number[] | null>) {
  // We don't need the real CopilotProviderFactory — Sinon stubs only the
  // public surface MemoryEmbedService exposes.
  const stub: Pick<MemoryEmbedService, 'embed' | 'dimensions'> = {
    embed: Sinon.stub().callsFake(async (text: string) => map[text] ?? null),
    dimensions: 1024,
  };
  return stub as MemoryEmbedService;
}

interface InsertedRow {
  id: string;
  workspaceId: string;
  userId: string | null;
  scope: 'user' | 'workspace';
  kind: 'FACT' | 'DECISION' | 'OBSERVATION' | 'PLAYBOOK';
  contentMd: string;
  embedding: number[];
}

/**
 * Tiny in-memory pgvector substitute. Stores rows in a JS array and
 * supports cosine-distance ranking. The Prisma `$executeRaw` and
 * `$queryRaw` template tags are intercepted: we don't parse SQL —
 * we trust the call shape and use the bound params to drive ops.
 */
function fakePrisma() {
  const rows: InsertedRow[] = [];

  // The Prisma raw API uses tagged templates. The first arg is the
  // strings array, the rest are values. Both ingest.service.ts and
  // retrieve.service.ts call this via `this.db.$executeRaw\`…\``
  // / `this.db.$queryRaw<T>\`…\`` — so we receive `(strings, ...values)`.
  //
  // For ingest, the call shape is INSERT … VALUES (id, workspaceId,
  // projectId, agentId, taskId, kind, contentMd, embeddingLiteral::vector,
  // scope, pinned, importance, userId, 0, NOW(), NOW())
  //
  // For retrieve, the call shape varies by scope set — we look at the
  // bound values to decide what filter to apply.

  function parseEmbeddingLiteral(literal: string): number[] {
    // shape: [1,2,3,…]
    const trimmed = literal.replace(/^\[|\]$/g, '');
    return trimmed.split(',').map(Number);
  }

  function cosineDistance(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 1;
    return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  const db = {
    rows,
    async $executeRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
      // bound params, in order (see ingest.service.ts):
      // 0:id 1:workspaceId 2:projectId 3:agentId 4:taskId 5:kind
      // 6:content 7:embeddingLiteral 8:scope 9:pinned 10:importance
      // 11:userId 12...:rest (ignored)
      const id = String(values[0]);
      const workspaceId = String(values[1]);
      const kind = String(values[5]) as InsertedRow['kind'];
      const content = String(values[6]);
      const embedding = parseEmbeddingLiteral(String(values[7]));
      const scope = String(values[8]) as InsertedRow['scope'];
      const userId = values[11] === null ? null : String(values[11]);
      rows.push({
        id,
        workspaceId,
        userId,
        scope,
        kind,
        contentMd: content,
        embedding,
      });
      return 1;
    },
    async $queryRaw<T>(_strings: TemplateStringsArray, ...values: unknown[]) {
      // retrieve.service.ts binds in this rough order across all 3 branches:
      //   [literal, workspaceId, ?userId, literal, topK]
      // We can't 100% disambiguate by position because the bound-param
      // order shifts. Instead we look at the strings template content
      // to figure out which branch we're in.
      const strings = _strings.join('');
      const wantsBoth =
        strings.includes(`"scope" = 'workspace'`) &&
        strings.includes(`"scope" = 'user'`);
      const wantsOnlyWorkspace =
        strings.includes(`"scope" = 'workspace'`) &&
        !strings.includes(`"scope" = 'user'`);
      const wantsOnlyUser =
        !strings.includes(`"scope" = 'workspace'`) &&
        strings.includes(`"scope" = 'user'`);

      // Param ordering by branch:
      //   wantsBoth:           [literal, workspaceId, userId, literal, topK]
      //   wantsOnlyWorkspace:  [literal, workspaceId, literal, topK]
      //   wantsOnlyUser:       [literal, workspaceId, userId, literal, topK]
      const literal = String(values[0]);
      const workspaceId = String(values[1]);
      let userId: string | null = null;
      let topK = 5;
      if (wantsBoth || wantsOnlyUser) {
        userId = String(values[2]);
        topK = Number(values[4]);
      } else if (wantsOnlyWorkspace) {
        topK = Number(values[3]);
      }

      const queryEmbed = parseEmbeddingLiteral(literal);
      const filtered = rows.filter(r => {
        if (r.workspaceId !== workspaceId) return false;
        if (wantsBoth) {
          return (
            r.scope === 'workspace' ||
            (r.scope === 'user' && r.userId === userId)
          );
        }
        if (wantsOnlyWorkspace) return r.scope === 'workspace';
        if (wantsOnlyUser) return r.scope === 'user' && r.userId === userId;
        return false;
      });
      const ranked = filtered
        .map(r => ({
          row: r,
          distance: cosineDistance(r.embedding, queryEmbed),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, topK);
      return ranked.map(({ row, distance }) => ({
        id: row.id,
        content_md: row.contentMd,
        kind: row.kind,
        scope: row.scope,
        created_at: new Date('2026-05-19T00:00:00Z'),
        distance,
      })) as unknown as T;
    },
  };
  return db;
}

// ---------------------------------------------------------------------------
// formatMemoriesForPrompt — pure helper, no DI
// ---------------------------------------------------------------------------

test('formatMemoriesForPrompt > given empty list > returns empty string', t => {
  t.is(formatMemoriesForPrompt([]), '');
});

test('formatMemoriesForPrompt > given memories > wraps each in tagged block', t => {
  const memories: RetrievedMemory[] = [
    {
      id: 'a',
      kind: 'PLAYBOOK',
      scope: 'workspace',
      content: 'Always prefer Vertex over OpenAI on this stack.',
      createdAt: new Date(),
    },
    {
      id: 'b',
      kind: 'FACT',
      scope: 'user',
      content: 'I prefer TypeScript over Go.',
      createdAt: new Date(),
    },
  ];
  const out = formatMemoriesForPrompt(memories);
  t.true(out.includes('<memories>'));
  t.true(out.includes('<memory kind="PLAYBOOK" scope="workspace">'));
  t.true(out.includes('<memory kind="FACT" scope="user">'));
  t.true(out.includes('Always prefer Vertex'));
  t.true(out.endsWith('\n\n'));
});

test('formatMemoriesForPrompt > content with </memory> > escapes to neutralize', t => {
  const memories: RetrievedMemory[] = [
    {
      id: 'a',
      kind: 'OBSERVATION',
      scope: 'user',
      content: 'see </memory> hack attempt',
      createdAt: new Date(),
    },
  ];
  const out = formatMemoriesForPrompt(memories);
  t.false(/see <\/memory>\s/i.test(out)); // raw closer should be escaped
  t.true(out.includes('</_memory>'));
});

// ---------------------------------------------------------------------------
// MemoryIngestService — happy path
// ---------------------------------------------------------------------------

test('MemoryIngestService.ingest > given user-scope memory > writes user_id', async t => {
  const embed = fakeEmbedService({
    'prefer typescript': vec(7),
  });
  const db = fakePrisma();
  const ingest = new MemoryIngestService(db as never, embed);
  const id = await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'user',
    kind: 'FACT',
    content: 'prefer typescript',
  });
  t.truthy(id);
  t.is(db.rows.length, 1);
  t.is(db.rows[0].scope, 'user');
  t.is(db.rows[0].userId, 'user-A');
  t.deepEqual(db.rows[0].embedding, vec(7));
});

test('MemoryIngestService.ingest > given workspace-scope > leaves user_id NULL', async t => {
  const embed = fakeEmbedService({ 'team decided X': vec(9) });
  const db = fakePrisma();
  const ingest = new MemoryIngestService(db as never, embed);
  await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'workspace',
    kind: 'DECISION',
    content: 'team decided X',
  });
  t.is(db.rows.length, 1);
  t.is(db.rows[0].scope, 'workspace');
  t.is(db.rows[0].userId, null);
});

test('MemoryIngestService.ingest > given null embedding > skips write silently', async t => {
  const embed = fakeEmbedService({}); // returns null for any input
  const db = fakePrisma();
  const ingest = new MemoryIngestService(db as never, embed);
  const id = await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'user',
    kind: 'FACT',
    content: 'something the embed provider rejected',
  });
  t.is(id, null);
  t.is(db.rows.length, 0);
});

// ---------------------------------------------------------------------------
// MemoryRetrieveService — similarity + scope filtering
// ---------------------------------------------------------------------------

test('MemoryRetrieveService.retrieve > returns memories ordered by similarity', async t => {
  const embed = fakeEmbedService({
    'pref ts': vec(7),
    typescript: vec(7),
    go: vec(800),
    rust: vec(900),
    query: vec(7),
  });
  const db = fakePrisma();
  const ingest = new MemoryIngestService(db as never, embed);
  const retrieve = new MemoryRetrieveService(db as never, embed);
  await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'user',
    kind: 'FACT',
    content: 'typescript',
  });
  await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'user',
    kind: 'FACT',
    content: 'go',
  });
  await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'user',
    kind: 'FACT',
    content: 'rust',
  });
  const result = await retrieve.retrieve({
    workspaceId: 'ws-1',
    userId: 'user-A',
    query: 'query',
    topK: 1,
  });
  t.is(result.length, 1);
  t.is(result[0].content, 'typescript'); // closest to vec(7)
});

test('MemoryRetrieveService.retrieve > user-scope NOT returned for another user', async t => {
  const embed = fakeEmbedService({
    'secret note': vec(50),
    query: vec(50),
  });
  const db = fakePrisma();
  const ingest = new MemoryIngestService(db as never, embed);
  const retrieve = new MemoryRetrieveService(db as never, embed);
  await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'user',
    kind: 'OBSERVATION',
    content: 'secret note',
  });
  const other = await retrieve.retrieve({
    workspaceId: 'ws-1',
    userId: 'user-B', // different user
    query: 'query',
  });
  t.is(other.length, 0);
  const owner = await retrieve.retrieve({
    workspaceId: 'ws-1',
    userId: 'user-A', // owner
    query: 'query',
  });
  t.is(owner.length, 1);
  t.is(owner[0].content, 'secret note');
});

test('MemoryRetrieveService.retrieve > workspace-scope returned for any user', async t => {
  const embed = fakeEmbedService({
    'shared playbook': vec(30),
    query: vec(30),
  });
  const db = fakePrisma();
  const ingest = new MemoryIngestService(db as never, embed);
  const retrieve = new MemoryRetrieveService(db as never, embed);
  await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'workspace',
    kind: 'PLAYBOOK',
    content: 'shared playbook',
  });
  const userA = await retrieve.retrieve({
    workspaceId: 'ws-1',
    userId: 'user-A',
    query: 'query',
  });
  const userB = await retrieve.retrieve({
    workspaceId: 'ws-1',
    userId: 'user-B',
    query: 'query',
  });
  t.is(userA.length, 1);
  t.is(userB.length, 1);
  t.is(userA[0].content, 'shared playbook');
  t.is(userB[0].content, 'shared playbook');
});

test('MemoryRetrieveService.retrieve > given workspace boundary > does not cross workspaces', async t => {
  const embed = fakeEmbedService({
    'in-ws1': vec(15),
    query: vec(15),
  });
  const db = fakePrisma();
  const ingest = new MemoryIngestService(db as never, embed);
  const retrieve = new MemoryRetrieveService(db as never, embed);
  await ingest.ingest({
    workspaceId: 'ws-1',
    userId: 'user-A',
    scope: 'workspace',
    kind: 'FACT',
    content: 'in-ws1',
  });
  // Same user, different workspace — should NOT see the ws-1 memory.
  const result = await retrieve.retrieve({
    workspaceId: 'ws-2',
    userId: 'user-A',
    query: 'query',
  });
  t.is(result.length, 0);
});

test('MemoryRetrieveService.retrieve > empty query > returns []', async t => {
  const embed = fakeEmbedService({});
  const db = fakePrisma();
  const retrieve = new MemoryRetrieveService(db as never, embed);
  const result = await retrieve.retrieve({
    workspaceId: 'ws-1',
    userId: 'user-A',
    query: '',
  });
  t.deepEqual(result, []);
});

test('MemoryRetrieveService.retrieve > null embedding > returns [] gracefully', async t => {
  const embed = fakeEmbedService({}); // embed returns null
  const db = fakePrisma();
  const retrieve = new MemoryRetrieveService(db as never, embed);
  const result = await retrieve.retrieve({
    workspaceId: 'ws-1',
    userId: 'user-A',
    query: 'anything',
  });
  t.deepEqual(result, []);
});
