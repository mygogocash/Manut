import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnSkillSource } from '@prisma/client';
import test from 'ava';

import { MnSkillService } from '../../plugins/manut/manut-skill.service';

/**
 * M5.1 skill service — CRUD invariants, slug uniqueness, version bump
 * enforcement, archived filtering, source enum.
 *
 * In-memory Prisma stub mirrors only the table shape the service
 * actually touches.
 */

interface FakeSkill {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description: string | null;
  contentMd: string;
  version: string;
  source: MnSkillSource;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const skills: FakeSkill[] = [];
  let nextId = 1;

  const db = {
    mnSkill: {
      create: async ({ data }: { data: Partial<FakeSkill> }) => {
        const dup = skills.find(
          s => s.workspaceId === data.workspaceId && s.slug === data.slug
        );
        if (dup) {
          const err = new Error('Unique constraint failed') as Error & {
            code: string;
          };
          err.code = 'P2002';
          throw err;
        }
        const now = new Date();
        const row: FakeSkill = {
          id: data.id ?? `sk-${nextId++}`,
          workspaceId: data.workspaceId!,
          slug: data.slug!,
          name: data.name!,
          description: data.description ?? null,
          contentMd: data.contentMd!,
          version: data.version!,
          source: data.source ?? MnSkillSource.WORKSPACE,
          archivedAt: data.archivedAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        skills.push(row);
        return row;
      },
      findUnique: async ({
        where,
      }: {
        where:
          | { id: string }
          | { workspaceId_slug: { workspaceId: string; slug: string } };
      }) => {
        if ('id' in where) {
          return skills.find(s => s.id === where.id) ?? null;
        }
        return (
          skills.find(
            s =>
              s.workspaceId === where.workspaceId_slug.workspaceId &&
              s.slug === where.workspaceId_slug.slug
          ) ?? null
        );
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: {
          workspaceId?: string;
          archivedAt?: null;
        };
        orderBy?: Array<{ updatedAt?: 'desc' | 'asc' }>;
      }) => {
        let rows = skills.slice();
        if (where?.workspaceId) {
          rows = rows.filter(s => s.workspaceId === where.workspaceId);
        }
        if (where && 'archivedAt' in where && where.archivedAt === null) {
          rows = rows.filter(s => s.archivedAt === null);
        }
        if (orderBy && orderBy[0]?.updatedAt === 'desc') {
          rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        return rows;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeSkill>;
      }) => {
        const row = skills.find(s => s.id === where.id);
        if (!row) throw new Error(`mnSkill not found: ${where.id}`);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
  };

  return { db: db as any, skills };
}

function service() {
  const ctx = createFakeDb();
  return { svc: new MnSkillService(ctx.db), ...ctx };
}

const WS = 'ws-1';

// ---------------------------------------------------------------------------
// CRUD basics
// ---------------------------------------------------------------------------

test('create > given valid input > persists with WORKSPACE source default', async t => {
  const { svc, skills } = service();
  const row = await svc.create(WS, {
    slug: 'docs.review',
    name: 'Doc review checklist',
    contentMd: '# How to review docs\n\n- Skim TOC first',
    version: '1.0.0',
  });
  t.is(row.workspaceId, WS);
  t.is(row.slug, 'docs.review');
  t.is(row.source, MnSkillSource.WORKSPACE);
  t.is(row.archivedAt, null);
  t.is(skills.length, 1);
});

test('create > given source IMPORTED > preserves source', async t => {
  const { svc } = service();
  const row = await svc.create(WS, {
    slug: 'imported-skill',
    name: 'Imported',
    contentMd: '# imported body',
    version: '0.1.0',
    source: MnSkillSource.IMPORTED,
  });
  t.is(row.source, MnSkillSource.IMPORTED);
});

test('create > given source BUILTIN > preserves source', async t => {
  const { svc } = service();
  const row = await svc.create(WS, {
    slug: 'builtin-skill',
    name: 'Builtin',
    contentMd: '# builtin body',
    version: '0.1.0',
    source: MnSkillSource.BUILTIN,
  });
  t.is(row.source, MnSkillSource.BUILTIN);
});

test('create > given duplicate (workspaceId, slug) > throws BadRequest', async t => {
  const { svc } = service();
  await svc.create(WS, {
    slug: 'dup',
    name: 'first',
    contentMd: '# first',
    version: '1.0.0',
  });
  await t.throwsAsync(
    () =>
      svc.create(WS, {
        slug: 'dup',
        name: 'second',
        contentMd: '# second',
        version: '1.0.0',
      }),
    { instanceOf: BadRequestException }
  );
});

test('create > given same slug in different workspace > allowed', async t => {
  const { svc } = service();
  await svc.create(WS, {
    slug: 'same-slug',
    name: 'one',
    contentMd: '# one',
    version: '1.0.0',
  });
  const row = await svc.create('ws-2', {
    slug: 'same-slug',
    name: 'two',
    contentMd: '# two',
    version: '1.0.0',
  });
  t.is(row.workspaceId, 'ws-2');
  t.is(row.slug, 'same-slug');
});

test('create > given invalid slug shape > throws ZodError', async t => {
  const { svc } = service();
  await t.throwsAsync(() =>
    svc.create(WS, {
      slug: 'Has Space And Caps',
      name: 'bad',
      contentMd: '# bad',
      version: '1.0.0',
    })
  );
});

test('get > given foreign workspace id > returns null', async t => {
  const { svc } = service();
  const created = await svc.create(WS, {
    slug: 'tenant-fence',
    name: 'tf',
    contentMd: '# tf',
    version: '1.0.0',
  });
  const miss = await svc.get('ws-other', created.id);
  t.is(miss, null);
});

test('getOrThrow > given unknown id > throws NotFound', async t => {
  const { svc } = service();
  await t.throwsAsync(() => svc.getOrThrow(WS, 'never-existed'), {
    instanceOf: NotFoundException,
  });
});

test('getBySlug > given exact slug > returns row', async t => {
  const { svc } = service();
  await svc.create(WS, {
    slug: 'lookup-by-slug',
    name: 'l',
    contentMd: '# l',
    version: '1.0.0',
  });
  const row = await svc.getBySlug(WS, 'lookup-by-slug');
  t.truthy(row);
  t.is(row?.slug, 'lookup-by-slug');
});

// ---------------------------------------------------------------------------
// Version-bump enforcement on contentMd change
// ---------------------------------------------------------------------------

test('update > given contentMd change without version bump > throws BadRequest', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'version-trap',
    name: 'vt',
    contentMd: '# original body',
    version: '1.0.0',
  });
  await t.throwsAsync(
    () =>
      svc.update(WS, skill.id, {
        contentMd: '# different body',
      }),
    { instanceOf: BadRequestException }
  );
});

test('update > given contentMd change with version bump > succeeds', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'version-ok',
    name: 'vo',
    contentMd: '# v1 body',
    version: '1.0.0',
  });
  const updated = await svc.update(WS, skill.id, {
    contentMd: '# v2 body',
    version: '1.1.0',
  });
  t.is(updated.contentMd, '# v2 body');
  t.is(updated.version, '1.1.0');
});

test('update > given metadata-only change > version need not bump', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'meta-only',
    name: 'mo',
    contentMd: '# stable body',
    version: '1.0.0',
  });
  const updated = await svc.update(WS, skill.id, {
    name: 'renamed',
    description: 'new description',
  });
  t.is(updated.name, 'renamed');
  t.is(updated.description, 'new description');
  t.is(updated.version, '1.0.0');
  t.is(updated.contentMd, '# stable body');
});

test('update > given same contentMd repeated > version need not bump', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'noop-content',
    name: 'nc',
    contentMd: '# unchanged',
    version: '1.0.0',
  });
  const updated = await svc.update(WS, skill.id, {
    contentMd: '# unchanged',
  });
  t.is(updated.version, '1.0.0');
});

test('update > given foreign workspace id > NotFound', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'fence-update',
    name: 'fu',
    contentMd: '# x',
    version: '1.0.0',
  });
  await t.throwsAsync(() => svc.update('ws-other', skill.id, { name: 'no' }), {
    instanceOf: NotFoundException,
  });
});

// ---------------------------------------------------------------------------
// Archived filtering + archive/restore idempotency
// ---------------------------------------------------------------------------

test('list > by default > excludes archived rows', async t => {
  const { svc } = service();
  const live = await svc.create(WS, {
    slug: 'live',
    name: 'live',
    contentMd: '# live',
    version: '1.0.0',
  });
  const gone = await svc.create(WS, {
    slug: 'gone',
    name: 'gone',
    contentMd: '# gone',
    version: '1.0.0',
  });
  await svc.archive(WS, gone.id);
  const visible = await svc.list(WS);
  t.is(visible.length, 1);
  t.is(visible[0].id, live.id);
});

test('list > given includeArchived > returns archived rows too', async t => {
  const { svc } = service();
  await svc.create(WS, {
    slug: 'live2',
    name: 'live2',
    contentMd: '# live',
    version: '1.0.0',
  });
  const gone = await svc.create(WS, {
    slug: 'gone2',
    name: 'gone2',
    contentMd: '# gone',
    version: '1.0.0',
  });
  await svc.archive(WS, gone.id);
  const everything = await svc.list(WS, { includeArchived: true });
  t.is(everything.length, 2);
});

test('archive > given live row > sets archivedAt', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'ax',
    name: 'ax',
    contentMd: '# ax',
    version: '1.0.0',
  });
  const archived = await svc.archive(WS, skill.id);
  t.truthy(archived.archivedAt);
});

test('archive > given already-archived > idempotent (no change)', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'idem',
    name: 'idem',
    contentMd: '# idem',
    version: '1.0.0',
  });
  const first = await svc.archive(WS, skill.id);
  const firstAt = first.archivedAt;
  await new Promise(r => setTimeout(r, 1));
  const second = await svc.archive(WS, skill.id);
  t.is(second.archivedAt?.getTime(), firstAt?.getTime());
});

test('restore > given archived row > clears archivedAt', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'restore-me',
    name: 'r',
    contentMd: '# r',
    version: '1.0.0',
  });
  await svc.archive(WS, skill.id);
  const restored = await svc.restore(WS, skill.id);
  t.is(restored.archivedAt, null);
});

test('restore > given live row > idempotent', async t => {
  const { svc } = service();
  const skill = await svc.create(WS, {
    slug: 'already-live',
    name: 'al',
    contentMd: '# al',
    version: '1.0.0',
  });
  const same = await svc.restore(WS, skill.id);
  t.is(same.archivedAt, null);
});
