/**
 * M14 — Work Queue service. CRUD + routing-rule evaluation.
 *
 * In-memory Prisma stub mirrors the table shape `MnWorkQueueService`
 * actually touches: mn_work_queues, mn_work_queue_intakes, mn_tasks,
 * mn_projects, mn_agent_roles, mn_agents. No real Postgres.
 *
 * Behaviour covered:
 *   - create generates a unique token + persists rules
 *   - routeIntake first-match-wins on `eq` and `contains`
 *   - routeIntake skips non-string field resolutions
 *   - routeIntake falls back to defaultAssigneeAgentId when no rule
 *     matches
 *   - routeIntake records REJECTED when queue.isActive is false
 *   - rotateToken changes the token and invalidates the prior one
 *   - archive flips isActive
 *   - parseRoutingRules rejects malformed JSON
 *   - assignToRoleSlug resolves to an agent with that role in the
 *     queue's project
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnIntakeStatus, MnTaskPriority } from '@prisma/client';
import test from 'ava';

import { MnWorkQueueService } from '../../plugins/manut/manut-work-queue.service';

interface FakeQueue {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
  intakeWebhookToken: string;
  routingRules: unknown;
  defaultAssigneeAgentId: string | null;
  defaultPriority: MnTaskPriority;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeIntake {
  id: string;
  queueId: string;
  externalRef: string | null;
  payload: unknown;
  status: MnIntakeStatus;
  routedToTaskId: string | null;
  receivedAt: Date;
}

interface FakeTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: MnTaskPriority;
  assigneeAgentId: string | null;
  status: string;
  createdAt: Date;
}

interface FakeProject {
  id: string;
  workspaceId: string;
}

interface FakeRole {
  id: string;
  workspaceId: string;
  slug: string;
}

interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
  roleId: string | null;
  createdAt: Date;
}

function createFakeDb() {
  const queues: FakeQueue[] = [];
  const intakes: FakeIntake[] = [];
  const tasks: FakeTask[] = [];
  const projects: FakeProject[] = [];
  const roles: FakeRole[] = [];
  const agents: FakeAgent[] = [];

  const db = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.find(p => p.id === where.id) ?? null,
    },
    mnWorkQueue: {
      create: async ({ data }: { data: Partial<FakeQueue> }) => {
        if (
          queues.some(q => q.intakeWebhookToken === data.intakeWebhookToken)
        ) {
          const err = new Error('Unique violation') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const now = new Date();
        const row: FakeQueue = {
          id: data.id!,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          name: data.name!,
          description: data.description ?? null,
          intakeWebhookToken: data.intakeWebhookToken!,
          routingRules: data.routingRules ?? [],
          defaultAssigneeAgentId: data.defaultAssigneeAgentId ?? null,
          defaultPriority: data.defaultPriority ?? MnTaskPriority.LOW,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        queues.push(row);
        return row;
      },
      findUnique: async ({
        where,
      }: {
        where: { id?: string; intakeWebhookToken?: string };
      }) => {
        if (where.id) {
          return queues.find(q => q.id === where.id) ?? null;
        }
        if (where.intakeWebhookToken) {
          return (
            queues.find(
              q => q.intakeWebhookToken === where.intakeWebhookToken
            ) ?? null
          );
        }
        return null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeQueue>;
      }) => {
        const row = queues.find(q => q.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        row.updatedAt = new Date();
        return row;
      },
      findMany: async ({ where }: { where: { workspaceId: string } }) =>
        queues.filter(q => q.workspaceId === where.workspaceId),
    },
    mnWorkQueueIntake: {
      create: async ({ data }: { data: Partial<FakeIntake> }) => {
        const row: FakeIntake = {
          id: data.id!,
          queueId: data.queueId!,
          externalRef: data.externalRef ?? null,
          payload: data.payload ?? null,
          status: data.status ?? MnIntakeStatus.RECEIVED,
          routedToTaskId: data.routedToTaskId ?? null,
          receivedAt: new Date(),
        };
        intakes.push(row);
        return row;
      },
      findMany: async ({
        where,
        take,
      }: {
        where: { queueId: string };
        take?: number;
      }) =>
        intakes.filter(i => i.queueId === where.queueId).slice(0, take ?? 100),
    },
    mnTask: {
      create: async ({ data }: { data: Partial<FakeTask> }) => {
        const row: FakeTask = {
          id: data.id!,
          projectId: data.projectId!,
          title: data.title!,
          description: data.description ?? null,
          priority: data.priority ?? MnTaskPriority.LOW,
          assigneeAgentId: data.assigneeAgentId ?? null,
          status: 'TODO',
          createdAt: new Date(),
        };
        tasks.push(row);
        return row;
      },
    },
    mnAgentRole: {
      findFirst: async ({
        where,
      }: {
        where: { workspaceId: string; slug: string };
      }) =>
        roles.find(
          r => r.workspaceId === where.workspaceId && r.slug === where.slug
        ) ?? null,
    },
    mnAgent: {
      findFirst: async ({
        where,
        orderBy: _orderBy,
      }: {
        where: { workspaceId: string; projectId: string; roleId: string };
        orderBy?: unknown;
      }) =>
        agents.find(
          a =>
            a.workspaceId === where.workspaceId &&
            a.projectId === where.projectId &&
            a.roleId === where.roleId
        ) ?? null,
    },
  };

  return { db, queues, intakes, tasks, projects, roles, agents };
}

function makeService(
  db: ReturnType<typeof createFakeDb>['db']
): MnWorkQueueService {
  return new MnWorkQueueService(
    db as unknown as ConstructorParameters<typeof MnWorkQueueService>[0]
  );
}

test('create rejects unknown project', async t => {
  const { db } = createFakeDb();
  const svc = makeService(db);
  await t.throwsAsync(
    svc.create('w1', { projectId: 'bogus', name: 'support' }),
    { instanceOf: NotFoundException }
  );
});

test('create rejects empty name', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  await t.throwsAsync(svc.create('w1', { projectId: 'p1', name: '   ' }), {
    instanceOf: BadRequestException,
  });
});

test('create rejects malformed routingRulesJson', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  await t.throwsAsync(
    svc.create('w1', {
      projectId: 'p1',
      name: 'support',
      routingRulesJson: 'not json',
    }),
    { instanceOf: BadRequestException }
  );
});

test('create generates a non-empty token', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', { projectId: 'p1', name: 'support' });
  t.true(q.intakeWebhookToken.length > 10);
});

test('routeIntake first-match-wins on eq', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', {
    projectId: 'p1',
    name: 'support',
    routingRulesJson: JSON.stringify([
      {
        match: { field: 'severity', op: 'eq', value: 'high' },
        assignToAgentId: 'agent-high',
      },
      {
        match: { field: 'severity', op: 'eq', value: 'low' },
        assignToAgentId: 'agent-low',
      },
    ]),
  });
  const result = await svc.routeIntake(q.id, { severity: 'low' });
  t.is(result.matchedRuleIndex, 1);
  t.is(result.assignedAgentId, 'agent-low');
  t.is(result.intake.status, MnIntakeStatus.ROUTED);
  t.not(result.taskId, null);
});

test('routeIntake matches `contains` case-insensitively', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', {
    projectId: 'p1',
    name: 'support',
    routingRulesJson: JSON.stringify([
      {
        match: { field: 'subject', op: 'contains', value: 'BILLING' },
        assignToAgentId: 'agent-billing',
      },
    ]),
  });
  const result = await svc.routeIntake(q.id, {
    subject: 'I have a billing question please help',
  });
  t.is(result.matchedRuleIndex, 0);
  t.is(result.assignedAgentId, 'agent-billing');
});

test('routeIntake falls back to defaultAssigneeAgentId on no match', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', {
    projectId: 'p1',
    name: 'support',
    routingRulesJson: JSON.stringify([
      {
        match: { field: 'severity', op: 'eq', value: 'high' },
        assignToAgentId: 'agent-high',
      },
    ]),
    defaultAssigneeAgentId: 'agent-catchall',
    defaultPriority: MnTaskPriority.MEDIUM,
  });
  const result = await svc.routeIntake(q.id, { severity: 'low' });
  t.is(result.matchedRuleIndex, null);
  t.is(result.assignedAgentId, 'agent-catchall');
});

test('routeIntake skips rules whose field resolves to non-string', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', {
    projectId: 'p1',
    name: 'support',
    routingRulesJson: JSON.stringify([
      {
        match: { field: 'count', op: 'eq', value: '5' },
        assignToAgentId: 'agent-counted',
      },
    ]),
  });
  // count is a number — `eq` against string '5' would coerce
  // misleadingly. Defensive skip means no match.
  const result = await svc.routeIntake(q.id, { count: 5 });
  t.is(result.matchedRuleIndex, null);
  t.is(result.assignedAgentId, null);
});

test('routeIntake records REJECTED when queue is inactive', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', { projectId: 'p1', name: 'support' });
  await svc.archive('w1', q.id);
  const result = await svc.routeIntake(q.id, { hello: 'world' });
  t.is(result.intake.status, MnIntakeStatus.REJECTED);
  t.is(result.taskId, null);
});

test('rotateToken invalidates the prior token', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', { projectId: 'p1', name: 'support' });
  const oldToken = q.intakeWebhookToken;
  await svc.rotateToken('w1', q.id);
  const lookupOld = await svc.findByToken(oldToken);
  t.is(lookupOld, null, 'old token should no longer resolve');
});

test('assignToRoleSlug resolves to an agent in the queue project', async t => {
  const { db, projects, roles, agents } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  roles.push({ id: 'role-support', workspaceId: 'w1', slug: 'support-tier-1' });
  agents.push({
    id: 'agent-support-1',
    workspaceId: 'w1',
    projectId: 'p1',
    roleId: 'role-support',
    createdAt: new Date(),
  });
  const svc = makeService(db);
  const q = await svc.create('w1', {
    projectId: 'p1',
    name: 'support',
    routingRulesJson: JSON.stringify([
      {
        match: { field: 'type', op: 'eq', value: 'support' },
        assignToRoleSlug: 'support-tier-1',
      },
    ]),
  });
  const result = await svc.routeIntake(q.id, { type: 'support' });
  t.is(result.assignedAgentId, 'agent-support-1');
});

test('getOrThrow rejects queue from another workspace', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'w1' });
  const svc = makeService(db);
  const q = await svc.create('w1', { projectId: 'p1', name: 'support' });
  await t.throwsAsync(svc.getOrThrow('other-ws', q.id), {
    instanceOf: NotFoundException,
  });
});
