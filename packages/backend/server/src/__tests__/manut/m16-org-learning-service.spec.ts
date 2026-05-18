import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnMemoryKind, MnSkillSource } from '@prisma/client';
import test from 'ava';

import {
  MnLearningCandidateStatus,
  type PlaybookExtractionPromptInput,
  type PlaybookExtractionPromptOutput,
} from '../../plugins/manut/manut-org-learning.dto';
import {
  __internal,
  MnOrgLearningService,
} from '../../plugins/manut/manut-org-learning.service';

/**
 * M16 — Automatic Organizational Learning service spec.
 *
 * Covers:
 *  1. Pure helpers — slug builder, marker round-trip, decision
 *     classification, importance map, version bump.
 *  2. `extractPlaybookFromTask` — persists a candidate MnSkill with
 *     source=IMPORTED and the candidate marker embedded in contentMd.
 *  3. The prompt template is invoked with the documented input shape
 *     (no real model call — we install a stub that captures the input).
 *  4. `extractDecisionMemory` — writes a DECISION memory per
 *     decision-flavored activity row, with importance derived from
 *     the task's priority.
 *  5. `listLearningCandidates` — only returns rows with the marker;
 *     filters by status; hides rejected by default.
 *  6. `approveLearningCandidate` — flips marker.status=approved; keeps
 *     source=IMPORTED; row not archived.
 *  7. `rejectLearningCandidate` — archives + flips marker.status.
 *  8. Cross-tenant fence — listing / approving from the wrong
 *     workspace cannot touch the row.
 *  9. Re-extracting on the same task produces a fresh candidate (slug
 *     suffix), not a collision error.
 *  10. Resilience — extract still completes when the task has zero
 *      memories / zero activities.
 *
 * In-memory Prisma stub mirrors only the tables the service touches:
 * `mnTask`, `mnTaskActivity`, `mnAgentMemory`, `mnSkill`.
 */

interface FakeProject {
  id: string;
  workspaceId: string;
}
interface FakeTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: string;
  definitionOfDone: unknown;
  assigneeAgentId: string | null;
  project: FakeProject;
}
interface FakeActivity {
  id: string;
  taskId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
interface FakeMemory {
  id: string;
  workspaceId: string;
  projectId: string;
  agentId: string;
  taskId: string | null;
  kind: MnMemoryKind;
  contentMd: string;
  importance: number;
  embedding: number[];
  retrievedCount: number;
  lastRetrievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
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
  const tasks: FakeTask[] = [];
  const activities: FakeActivity[] = [];
  const memories: FakeMemory[] = [];
  const skills: FakeSkill[] = [];
  let skillSeq = 0;
  let memSeq = 0;

  const db = {
    mnTask: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        tasks.find(t => t.id === where.id) ?? null,
    },
    mnTaskActivity: {
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where: { taskId: string };
        orderBy?: Array<{ createdAt?: 'asc' | 'desc' }>;
        take?: number;
      }) => {
        let rows = activities.filter(a => a.taskId === where.taskId).slice();
        const dir = orderBy?.[0]?.createdAt ?? 'asc';
        rows.sort((a, b) =>
          dir === 'desc'
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime()
        );
        if (take) rows = rows.slice(0, take);
        return rows;
      },
    },
    mnAgentMemory: {
      findMany: async ({
        where,
        take,
      }: {
        where: {
          workspaceId: string;
          taskId?: string | null;
          agentId?: string;
        };
        orderBy?: unknown;
        take?: number;
      }) => {
        let rows = memories.filter(m => m.workspaceId === where.workspaceId);
        if ('taskId' in where) {
          rows = rows.filter(m => m.taskId === where.taskId);
        }
        if (where.agentId) {
          rows = rows.filter(m => m.agentId === where.agentId);
        }
        rows = rows.slice();
        rows.sort((a, b) => {
          if (a.importance !== b.importance) {
            return b.importance - a.importance;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        if (take) rows = rows.slice(0, take);
        return rows;
      },
      create: async ({ data }: { data: Partial<FakeMemory> }) => {
        const now = new Date();
        const row: FakeMemory = {
          id: data.id ?? `mem-${++memSeq}`,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          agentId: data.agentId!,
          taskId: data.taskId ?? null,
          kind: data.kind!,
          contentMd: data.contentMd!,
          importance: data.importance ?? 1,
          embedding: data.embedding ?? [],
          retrievedCount: 0,
          lastRetrievedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        memories.push(row);
        return row;
      },
    },
    mnSkill: {
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
          source?: MnSkillSource;
          contentMd?: { contains?: string };
        };
        orderBy?: Array<{ updatedAt?: 'desc' | 'asc' }>;
      }) => {
        let rows = skills.slice();
        if (where?.workspaceId) {
          rows = rows.filter(s => s.workspaceId === where.workspaceId);
        }
        if (where?.source) {
          rows = rows.filter(s => s.source === where.source);
        }
        if (where?.contentMd?.contains) {
          const needle = where.contentMd.contains;
          rows = rows.filter(s => s.contentMd.includes(needle));
        }
        if (orderBy?.[0]?.updatedAt === 'desc') {
          rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        return rows;
      },
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
          id: data.id ?? `sk-${++skillSeq}`,
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

  return {
    db: db as any,
    tasks,
    activities,
    memories,
    skills,
  };
}

function seedTask(
  tasks: FakeTask[],
  overrides: Partial<FakeTask> = {}
): FakeTask {
  // IMPORTANT: use `in` rather than `??` for the nullable fields so a
  // test that passes `assigneeAgentId: null` actually gets null, not
  // the default. The `??` operator skips null + undefined together,
  // which would silently break the "no agent assignee" branch.
  const task: FakeTask = {
    id: overrides.id ?? 'task-1',
    projectId: overrides.projectId ?? 'proj-1',
    title: overrides.title ?? 'Ship onboarding refresh',
    description: 'description' in overrides ? overrides.description! : null,
    priority: overrides.priority ?? 'MEDIUM',
    definitionOfDone:
      'definitionOfDone' in overrides ? overrides.definitionOfDone : null,
    assigneeAgentId:
      'assigneeAgentId' in overrides ? overrides.assigneeAgentId! : 'agent-1',
    project: overrides.project ?? {
      id: overrides.projectId ?? 'proj-1',
      workspaceId: 'ws-1',
    },
  };
  tasks.push(task);
  return task;
}

// ---------------------------------------------------------------------------
// Pure-helper tests — fast, no service instantiation.
// ---------------------------------------------------------------------------

test('buildCandidateSlug satisfies M5 slug regex', t => {
  const SLUG_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
  const slug = __internal.buildCandidateSlug(
    'Ship Onboarding!! v2',
    'abcd-efgh-9999'
  );
  t.regex(slug, SLUG_PATTERN);
  t.true(slug.startsWith('auto-learning.'));
});

test('buildCandidateSlug falls back to "untitled" on empty title', t => {
  const SLUG_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
  const slug = __internal.buildCandidateSlug('   ', 'tid-aaaaaaaa');
  t.regex(slug, SLUG_PATTERN);
  t.true(slug.includes('untitled'));
});

test('marker round-trip preserves payload, leaves contentMd cleanable', t => {
  const stamped = __internal.stampMarkerOntoContent('# Body\n\nbody-line', {
    candidateOf: 'auto-learning',
    sourceTaskId: 'task-42',
    status: 'pending',
  });
  t.true(stamped.includes('mn-learning-candidate'));
  const parsed = __internal.parseMarker(stamped);
  t.truthy(parsed);
  t.is(parsed!.sourceTaskId, 'task-42');
  t.is(parsed!.status, 'pending');

  const stripped = __internal.stripMarkerFromContent(stamped);
  t.false(stripped.includes('mn-learning-candidate'));
  t.true(stripped.includes('body-line'));
});

test('isDecisionActivity recognises action prefix + metadata kind', t => {
  t.true(
    __internal.isDecisionActivity({
      action: 'decision_approved',
      metadata: {},
    })
  );
  t.true(
    __internal.isDecisionActivity({
      action: 'comment_added',
      metadata: { kind: 'decision' },
    })
  );
  t.false(
    __internal.isDecisionActivity({
      action: 'comment_added',
      metadata: {},
    })
  );
});

test('mapPriorityToImportance scales as documented', t => {
  t.is(__internal.mapPriorityToImportance('URGENT'), 8);
  t.is(__internal.mapPriorityToImportance('HIGH'), 6);
  t.is(__internal.mapPriorityToImportance('MEDIUM'), 4);
  t.is(__internal.mapPriorityToImportance('LOW'), 2);
  t.is(__internal.mapPriorityToImportance('NONE'), 2);
});

test('bumpVersion stays inside the M5 VERSION_PATTERN char class', t => {
  const VERSION_PATTERN = /^[A-Za-z0-9._+-]+$/;
  const v = __internal.bumpVersion(
    'auto-2026-05-18',
    MnLearningCandidateStatus.APPROVED
  );
  t.regex(v, VERSION_PATTERN);
  t.true(v.includes('approved'));
});

// ---------------------------------------------------------------------------
// Service behaviour tests.
// ---------------------------------------------------------------------------

test('extractPlaybookFromTask persists IMPORTED candidate with marker', async t => {
  const { db, tasks, memories, skills } = createFakeDb();
  seedTask(tasks);

  // Seed a memory so the prompt template sees relatedMemorySnippets.
  memories.push({
    id: 'mem-seed',
    workspaceId: 'ws-1',
    projectId: 'proj-1',
    agentId: 'agent-1',
    taskId: 'task-1',
    kind: MnMemoryKind.OBSERVATION,
    contentMd: 'shipped on day 3 after pivoting away from modal',
    importance: 4,
    embedding: [],
    retrievedCount: 0,
    lastRetrievedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const svc = new MnOrgLearningService(db);
  const row = await svc.extractPlaybookFromTask('task-1', 'ws-1');

  t.is(row.workspaceId, 'ws-1');
  t.is(row.source, MnSkillSource.IMPORTED);
  t.is(skills.length, 1);
  t.true(row.contentMd.includes('mn-learning-candidate'));
  const marker = __internal.parseMarker(row.contentMd);
  t.is(marker!.sourceTaskId, 'task-1');
  t.is(marker!.status, 'pending');
});

test('extractPlaybookFromTask invokes prompt template with documented input shape', async t => {
  const { db, tasks, memories } = createFakeDb();
  seedTask(tasks, {
    description: 'Refresh the onboarding stepper',
    priority: 'HIGH',
    definitionOfDone: [{ kind: 'DOC_EXISTS', docId: 'doc-1' }],
  });
  memories.push({
    id: 'mem-fact',
    workspaceId: 'ws-1',
    projectId: 'proj-1',
    agentId: 'agent-1',
    taskId: 'task-1',
    kind: MnMemoryKind.FACT,
    contentMd: 'team-velocity = 5 tasks/sprint',
    importance: 3,
    embedding: [],
    retrievedCount: 0,
    lastRetrievedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const svc = new MnOrgLearningService(db);
  let captured: PlaybookExtractionPromptInput | null = null;
  svc.setPromptTemplate(
    async (input): Promise<PlaybookExtractionPromptOutput> => {
      captured = input;
      return {
        slug: 'overridden-slug',
        name: 'Custom playbook',
        body: '# Custom body\n\nMore text.',
        observations: ['FACT'],
      };
    }
  );

  await svc.extractPlaybookFromTask('task-1', 'ws-1');

  t.truthy(captured);
  t.is(captured!.taskId, 'task-1');
  t.is(captured!.workspaceId, 'ws-1');
  t.is(captured!.projectId, 'proj-1');
  t.is(captured!.title, 'Ship onboarding refresh');
  t.is(captured!.description, 'Refresh the onboarding stepper');
  t.deepEqual(captured!.definitionOfDone, [
    { kind: 'DOC_EXISTS', docId: 'doc-1' },
  ]);
  t.is(captured!.relatedMemorySnippets.length, 1);
  t.is(captured!.relatedMemorySnippets[0].kind, 'FACT');
});

test('extractPlaybookFromTask refuses cross-workspace task ids', async t => {
  const { db, tasks } = createFakeDb();
  seedTask(tasks);

  const svc = new MnOrgLearningService(db);
  await t.throwsAsync(() => svc.extractPlaybookFromTask('task-1', 'ws-OTHER'), {
    instanceOf: NotFoundException,
  });
});

test('extractDecisionMemory writes DECISION rows with priority-derived importance', async t => {
  const { db, tasks, activities, memories } = createFakeDb();
  seedTask(tasks, { priority: 'URGENT', assigneeAgentId: 'agent-1' });
  activities.push({
    id: 'act-1',
    taskId: 'task-1',
    action: 'decision_approved',
    metadata: { who: 'kunanon' },
    createdAt: new Date('2026-05-18T00:00:00Z'),
  });
  activities.push({
    id: 'act-2',
    taskId: 'task-1',
    action: 'comment_added',
    metadata: { kind: 'decision', summary: 'split the worker queue' },
    createdAt: new Date('2026-05-18T01:00:00Z'),
  });
  activities.push({
    id: 'act-3',
    taskId: 'task-1',
    action: 'noise',
    metadata: {},
    createdAt: new Date('2026-05-18T02:00:00Z'),
  });

  const svc = new MnOrgLearningService(db);
  const count = await svc.extractDecisionMemory('task-1', 'ws-1');

  t.is(count, 2);
  const decisionRows = memories.filter(m => m.kind === MnMemoryKind.DECISION);
  t.is(decisionRows.length, 2);
  for (const row of decisionRows) {
    t.is(row.importance, 8);
    t.is(row.agentId, 'agent-1');
    t.is(row.taskId, 'task-1');
    t.true(row.contentMd.startsWith('[DECISION]'));
  }
});

test('extractDecisionMemory is a no-op when task has no agent assignee', async t => {
  const { db, tasks, activities, memories } = createFakeDb();
  seedTask(tasks, { assigneeAgentId: null });
  activities.push({
    id: 'act-1',
    taskId: 'task-1',
    action: 'decision_approved',
    metadata: {},
    createdAt: new Date(),
  });

  const svc = new MnOrgLearningService(db);
  const count = await svc.extractDecisionMemory('task-1', 'ws-1');
  t.is(count, 0);
  t.is(memories.length, 0);
});

test('listLearningCandidates only returns marker-bearing rows, filters by status', async t => {
  const { db, tasks } = createFakeDb();
  seedTask(tasks);

  const svc = new MnOrgLearningService(db);
  await svc.extractPlaybookFromTask('task-1', 'ws-1');

  // Add a non-candidate WORKSPACE skill to prove it gets filtered out.
  await (db as any).mnSkill.create({
    data: {
      id: 'sk-rogue',
      workspaceId: 'ws-1',
      slug: 'team.docs.review',
      name: 'Hand-authored',
      description: null,
      contentMd: '# Hand authored body',
      version: '1.0.0',
      source: MnSkillSource.WORKSPACE,
      archivedAt: null,
    },
  });
  // And an IMPORTED skill WITHOUT the marker (AGENTS.md import).
  await (db as any).mnSkill.create({
    data: {
      id: 'sk-agentsmd',
      workspaceId: 'ws-1',
      slug: 'imported.agents-md',
      name: 'Imported from AGENTS.md',
      description: null,
      contentMd: '# Some AGENTS.md content',
      version: '1.0.0',
      source: MnSkillSource.IMPORTED,
      archivedAt: null,
    },
  });

  const pending = await svc.listLearningCandidates('ws-1', {
    status: MnLearningCandidateStatus.PENDING,
  });
  t.is(pending.length, 1);
  t.is(pending[0].status, MnLearningCandidateStatus.PENDING);
  t.is(pending[0].sourceTaskId, 'task-1');

  const approved = await svc.listLearningCandidates('ws-1', {
    status: MnLearningCandidateStatus.APPROVED,
  });
  t.is(approved.length, 0);
});

test('approve flips status to APPROVED, keeps source=IMPORTED, does not archive', async t => {
  const { db, tasks } = createFakeDb();
  seedTask(tasks);

  const svc = new MnOrgLearningService(db);
  const created = await svc.extractPlaybookFromTask('task-1', 'ws-1');
  const promoted = await svc.approveLearningCandidate('ws-1', created.id);

  t.is(promoted.source, MnSkillSource.IMPORTED);
  t.is(promoted.archivedAt, null);
  const marker = __internal.parseMarker(promoted.contentMd);
  t.is(marker!.status, 'approved');

  const stillPending = await svc.listLearningCandidates('ws-1');
  t.is(stillPending.length, 0);
  const approvedList = await svc.listLearningCandidates('ws-1', {
    status: MnLearningCandidateStatus.APPROVED,
  });
  t.is(approvedList.length, 1);
});

test('reject flips status AND archives the row; surfaces under REJECTED filter', async t => {
  const { db, tasks } = createFakeDb();
  seedTask(tasks);

  const svc = new MnOrgLearningService(db);
  const created = await svc.extractPlaybookFromTask('task-1', 'ws-1');
  const rejected = await svc.rejectLearningCandidate('ws-1', created.id);

  t.is(rejected.source, MnSkillSource.IMPORTED);
  t.not(rejected.archivedAt, null);
  const marker = __internal.parseMarker(rejected.contentMd);
  t.is(marker!.status, 'rejected');

  const pending = await svc.listLearningCandidates('ws-1');
  t.is(pending.length, 0);
  const rejectedList = await svc.listLearningCandidates('ws-1', {
    status: MnLearningCandidateStatus.REJECTED,
  });
  t.is(rejectedList.length, 1);
});

test('approve refuses a candidate id from another workspace', async t => {
  const { db, tasks } = createFakeDb();
  seedTask(tasks);

  const svc = new MnOrgLearningService(db);
  const created = await svc.extractPlaybookFromTask('task-1', 'ws-1');
  await t.throwsAsync(
    () => svc.approveLearningCandidate('ws-OTHER', created.id),
    { instanceOf: NotFoundException }
  );
});

test('re-extracting on the same task produces a fresh candidate, not a collision', async t => {
  const { db, tasks, skills } = createFakeDb();
  seedTask(tasks);

  const svc = new MnOrgLearningService(db);
  const first = await svc.extractPlaybookFromTask('task-1', 'ws-1');
  const second = await svc.extractPlaybookFromTask('task-1', 'ws-1');
  t.not(first.id, second.id);
  t.not(first.slug, second.slug);
  t.is(skills.length, 2);
});

test('extract still completes when task has no memories and no activities', async t => {
  const { db, tasks } = createFakeDb();
  seedTask(tasks, { description: null });

  const svc = new MnOrgLearningService(db);
  const row = await svc.extractPlaybookFromTask('task-1', 'ws-1');
  t.is(row.source, MnSkillSource.IMPORTED);
  t.true(row.contentMd.includes('mn-learning-candidate'));
});

test('extractDecisionMemory rejects empty taskId / workspaceId', async t => {
  const { db } = createFakeDb();
  const svc = new MnOrgLearningService(db);
  await t.throwsAsync(() => svc.extractDecisionMemory('', 'ws-1'), {
    instanceOf: BadRequestException,
  });
  await t.throwsAsync(() => svc.extractDecisionMemory('task-1', ''), {
    instanceOf: BadRequestException,
  });
});
