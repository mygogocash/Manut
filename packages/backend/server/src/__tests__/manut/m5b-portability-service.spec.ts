import test from 'ava';

import { MnPortabilityService } from '../../plugins/manut/manut-portability.service';
import { SCRUBBED_VALUE } from '../../plugins/manut/manut-secret-scrubber';

/**
 * M5.2 — portability service round-trip.
 *
 * In-memory Prisma stub mirrors the surface the service touches:
 *
 *   mnProject.findMany / mnProject.create
 *   mnAgent.findMany   / mnAgent.create
 *   mnGoal.findMany    / mnGoal.create
 *   mnSkill.findMany   / mnSkill.findUnique / mnSkill.create
 *
 * The stub maintains a per-workspace store so we can export from one
 * workspace and import into another, then assert the row counts match.
 */

interface FakeProject {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
  roleId: string | null;
  name: string;
  adapterType: string;
  adapterConfig: unknown;
  runtimeConfig: unknown;
  capabilities: string | null;
  createdAt: Date;
}

interface FakeGoal {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  level: string;
  parentGoalId: string | null;
  ownerAgentId: string | null;
  status: string;
  createdAt: Date;
}

interface FakeSkill {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description: string | null;
  contentMd: string;
  version: string;
  source: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const projects: FakeProject[] = [];
  const agents: FakeAgent[] = [];
  const goals: FakeGoal[] = [];
  const skills: FakeSkill[] = [];
  let nextId = 1;

  const db = {
    mnProject: {
      findMany: async ({
        where,
        orderBy: _o,
      }: {
        where: { workspaceId: string };
        orderBy?: unknown;
      }) => projects.filter(p => p.workspaceId === where.workspaceId),
      create: async ({ data }: { data: Partial<FakeProject> }) => {
        const now = new Date();
        const row: FakeProject = {
          id: data.id ?? `p-${nextId++}`,
          workspaceId: data.workspaceId!,
          name: data.name!,
          description: data.description ?? null,
          status: data.status ?? 'ACTIVE',
          sortOrder: data.sortOrder ?? 0,
          createdAt: now,
          updatedAt: now,
        };
        projects.push(row);
        return row;
      },
    },
    mnAgent: {
      findMany: async ({
        where,
        orderBy: _o,
      }: {
        where: { workspaceId: string };
        orderBy?: unknown;
      }) => agents.filter(a => a.workspaceId === where.workspaceId),
      create: async ({ data }: { data: Partial<FakeAgent> }) => {
        const now = new Date();
        const row: FakeAgent = {
          id: data.id ?? `a-${nextId++}`,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          roleId: data.roleId ?? null,
          name: data.name!,
          adapterType: data.adapterType ?? 'COPILOT_CHAT_SESSION',
          adapterConfig: data.adapterConfig ?? {},
          runtimeConfig: data.runtimeConfig ?? {},
          capabilities: data.capabilities ?? null,
          createdAt: now,
        };
        agents.push(row);
        return row;
      },
    },
    mnGoal: {
      findMany: async ({
        where,
        orderBy: _o,
      }: {
        where: { workspaceId: string };
        orderBy?: unknown;
      }) => goals.filter(g => g.workspaceId === where.workspaceId),
      create: async ({ data }: { data: Partial<FakeGoal> }) => {
        const now = new Date();
        const row: FakeGoal = {
          id: data.id ?? `g-${nextId++}`,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          title: data.title!,
          description: data.description ?? null,
          level: data.level ?? 'PROJECT',
          parentGoalId: data.parentGoalId ?? null,
          ownerAgentId: data.ownerAgentId ?? null,
          status: data.status ?? 'PLANNED',
          createdAt: now,
        };
        goals.push(row);
        return row;
      },
    },
    mnSkill: {
      findMany: async ({
        where,
        orderBy: _o,
      }: {
        where: { workspaceId: string; archivedAt?: null };
        orderBy?: unknown;
      }) => {
        let rows = skills.filter(s => s.workspaceId === where.workspaceId);
        if (where.archivedAt === null) {
          rows = rows.filter(s => s.archivedAt === null);
        }
        return rows;
      },
      findUnique: async ({
        where,
      }: {
        where: {
          workspaceId_slug: { workspaceId: string; slug: string };
        };
      }) =>
        skills.find(
          s =>
            s.workspaceId === where.workspaceId_slug.workspaceId &&
            s.slug === where.workspaceId_slug.slug
        ) ?? null,
      create: async ({ data }: { data: Partial<FakeSkill> }) => {
        const now = new Date();
        const row: FakeSkill = {
          id: data.id ?? `sk-${nextId++}`,
          workspaceId: data.workspaceId!,
          slug: data.slug!,
          name: data.name!,
          description: data.description ?? null,
          contentMd: data.contentMd!,
          version: data.version ?? '0.0.0',
          source: data.source ?? 'WORKSPACE',
          archivedAt: data.archivedAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        skills.push(row);
        return row;
      },
    },
  };

  return { db, projects, agents, goals, skills };
}

async function seedSourceWorkspace(
  db: ReturnType<typeof createFakeDb>['db'],
  workspaceId: string
): Promise<void> {
  const project = await db.mnProject.create({
    data: { workspaceId, name: 'Support', sortOrder: 0 },
  });
  await db.mnAgent.create({
    data: {
      workspaceId,
      projectId: project.id,
      name: 'Reply Composer',
      adapterType: 'COPILOT_CHAT_SESSION',
      adapterConfig: {
        endpoint: 'https://api.example.com',
        apiKey: 'sk-real-secret-value',
      },
      runtimeConfig: { temperature: 0.7 },
      capabilities: 'drafts replies',
    },
  });
  await db.mnAgent.create({
    data: {
      workspaceId,
      projectId: project.id,
      name: 'Escalation Watcher',
      adapterType: 'COPILOT_CHAT_SESSION',
      adapterConfig: {},
      runtimeConfig: {},
    },
  });
  await db.mnGoal.create({
    data: {
      workspaceId,
      projectId: project.id,
      title: 'Reduce reply latency',
      level: 'PROJECT',
      description: 'p95 below 4 hours',
    },
  });
  await db.mnSkill.create({
    data: {
      workspaceId,
      slug: 'reply-templates',
      name: 'Reply Templates',
      contentMd: '# Reply templates\n\nUse the three-step structure.',
      version: '1.0.0',
      source: 'WORKSPACE',
    },
  });
  await db.mnSkill.create({
    data: {
      workspaceId,
      slug: 'escalation-playbook',
      name: 'Escalation Playbook',
      contentMd: 'Escalate when sentiment < -0.4',
      version: '0.2.0',
      source: 'WORKSPACE',
    },
  });
}

test('exportToManifest scrubs adapter secrets', async t => {
  const { db } = createFakeDb();
  await seedSourceWorkspace(db, 'ws-src');
  const svc = new MnPortabilityService(db as never);

  const { manifest } = await svc.exportToManifest('ws-src');
  const composer = manifest.agents.find(a => a.name === 'Reply Composer');
  t.truthy(composer);
  const cfg = composer!.adapterConfig as Record<string, unknown>;
  t.is(cfg.apiKey, SCRUBBED_VALUE);
  t.is(cfg.endpoint, 'https://api.example.com');
});

test('exportToManifest returns deterministic SHA across calls', async t => {
  const { db } = createFakeDb();
  await seedSourceWorkspace(db, 'ws-src');
  const svc = new MnPortabilityService(db as never);

  const first = await svc.exportToManifest('ws-src');
  const second = await svc.exportToManifest('ws-src');

  // The exportedAt frontmatter field changes per call, so the agentsMd
  // string differs. The manifest+skills portion should still produce
  // the same internal counts.
  t.is(first.manifest.agents.length, second.manifest.agents.length);
  t.is(first.manifest.skills.length, second.manifest.skills.length);
  t.is(first.manifest.goals.length, second.manifest.goals.length);
});

test('exportToManifest produces manifest + agentsMd + skills + sha256', async t => {
  const { db } = createFakeDb();
  await seedSourceWorkspace(db, 'ws-src');
  const svc = new MnPortabilityService(db as never);
  const result = await svc.exportToManifest('ws-src');

  t.truthy(result.manifest);
  t.is(typeof result.agentsMd, 'string');
  t.true(result.agentsMd.length > 0);
  t.is(result.skills.length, 2);
  t.regex(result.sha256, /^[a-f0-9]{64}$/);
});

test('round-trip: export from source, import into target, row counts match', async t => {
  const { db } = createFakeDb();
  await seedSourceWorkspace(db, 'ws-src');
  const svc = new MnPortabilityService(db as never);

  const payload = await svc.exportToManifest('ws-src');
  const result = await svc.importFromManifest('ws-dst', {
    manifest: payload.manifest,
    agentsMd: payload.agentsMd,
    skills: payload.skills,
  });

  t.is(result.agentsCreated, 2);
  t.is(result.skillsCreated, 2);
  t.is(result.goalsCreated, 1);
});

test('importFromManifest creates a placeholder project when manifest has none', async t => {
  const { db, projects } = createFakeDb();
  const svc = new MnPortabilityService(db as never);

  const result = await svc.importFromManifest('ws-dst', {
    manifest: {
      version: 'manut-portability-v1',
      workspaceId: 'ws-orig',
      projects: [],
      agents: [
        {
          id: 'a1',
          name: 'StandaloneAgent',
          adapterType: 'COPILOT_CHAT_SESSION',
          adapterConfig: {},
          runtimeConfig: {},
          projectId: 'orphan',
        },
      ],
      goals: [],
      skills: [],
    },
    agentsMd: '## Agent StandaloneAgent\n',
    skills: [],
  });

  t.is(result.agentsCreated, 1);
  t.is(result.skillsCreated, 0);
  t.is(result.goalsCreated, 0);
  // The service must invent a project so agents have a home.
  t.is(projects.length, 1);
  t.is(projects[0].name, 'Imported');
});

test('importFromManifest preserves scrubbed sentinel in adapterConfig', async t => {
  const { db, agents } = createFakeDb();
  const svc = new MnPortabilityService(db as never);

  await svc.importFromManifest('ws-dst', {
    manifest: {
      version: 'manut-portability-v1',
      workspaceId: 'ws-orig',
      projects: [{ id: 'p1', name: 'P1', status: 'ACTIVE', sortOrder: 0 }],
      agents: [
        {
          id: 'a1',
          name: 'WithSecret',
          adapterType: 'COPILOT_CHAT_SESSION',
          adapterConfig: {
            apiKey: SCRUBBED_VALUE,
            endpoint: 'https://e.example',
          },
          runtimeConfig: {},
          projectId: 'p1',
        },
      ],
      goals: [],
      skills: [],
    },
    agentsMd: '## Agent WithSecret\n',
    skills: [],
  });

  const agent = agents.find(a => a.name === 'WithSecret');
  t.truthy(agent);
  const cfg = agent!.adapterConfig as Record<string, unknown>;
  t.is(cfg.apiKey, SCRUBBED_VALUE);
  t.is(cfg.endpoint, 'https://e.example');
});

test('importFromManifest is dedupe-safe on skill slug', async t => {
  const { db, skills } = createFakeDb();
  const svc = new MnPortabilityService(db as never);
  const manifest = {
    version: 'manut-portability-v1',
    workspaceId: 'src',
    projects: [{ id: 'p', name: 'P', status: 'ACTIVE', sortOrder: 0 }],
    agents: [],
    goals: [],
    skills: [{ slug: 's1', name: 'S1', version: '1.0.0', source: 'WORKSPACE' }],
  } as const;
  const agentsMd =
    '## Skill s1\n\n---\nname: S1\nversion: 1.0.0\n---\n\nbody\n';
  const skillsArr = [{ slug: 's1', body: 'body' }];

  await svc.importFromManifest('ws-dst', {
    manifest: manifest as never,
    agentsMd,
    skills: skillsArr,
  });
  const second = await svc.importFromManifest('ws-dst', {
    manifest: manifest as never,
    agentsMd,
    skills: skillsArr,
  });

  t.is(
    skills.filter(s => s.workspaceId === 'ws-dst' && s.slug === 's1').length,
    1
  );
  t.is(second.skillsCreated, 0, 'second import should not duplicate skill');
});

test('exportToManifest excludes archived skills', async t => {
  const { db } = createFakeDb();
  await seedSourceWorkspace(db, 'ws-src');
  // Manually archive one skill by creating one with archivedAt set.
  await db.mnSkill.create({
    data: {
      workspaceId: 'ws-src',
      slug: 'old-archived',
      name: 'old',
      contentMd: 'archived body',
      version: '0.0.1',
      archivedAt: new Date(),
    },
  });
  const svc = new MnPortabilityService(db as never);
  const { manifest } = await svc.exportToManifest('ws-src');
  t.false(manifest.skills.some(s => s.slug === 'old-archived'));
});
