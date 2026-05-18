/**
 * M17 — MnCeoChatService unit spec.
 *
 * Covers:
 *  - classifyIntent heuristics (each keyword routes to the right
 *    MnCeoResolutionKind; non-matching bodies fall back to NONE)
 *  - createConversation rejects empty workspaceId / ownerUserId
 *  - addTurn appends + bumps conversation.updatedAt
 *  - addTurn refuses missing conversations
 *  - addTurn refuses empty body
 *  - resolveIntent creates an MnTask when intent classifies as
 *    TASK_CREATED, and stores its id on the turn
 *  - resolveIntent creates an MnApproval when intent classifies as
 *    APPROVAL_REQUESTED
 *  - resolveIntent short-circuits CEO_AGENT turns (no double-resolution)
 *  - getConversation workspace fence (returns null cross-workspace)
 *
 * In-memory Prisma stub mirrors only the shape MnCeoChatService
 * actually touches: mnCeoConversation, mnCeoTurn, mnTask, mnApproval,
 * mnTaskPlan, mnProject.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MnApprovalType,
  MnCeoResolutionKind,
  MnCeoTurnRole,
} from '@prisma/client';
import test from 'ava';

import { MnCeoChatService } from '../../plugins/manut/manut-ceo-chat.service';

interface FakeConversation {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  title: string | null;
  lastResolutionKind: MnCeoResolutionKind | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeTurn {
  id: string;
  conversationId: string;
  role: MnCeoTurnRole;
  bodyMd: string;
  resolutionKind: MnCeoResolutionKind;
  resolutionRefId: string | null;
  createdAt: Date;
}

interface FakeProject {
  id: string;
  workspaceId: string;
  createdAt: Date;
}

interface FakeTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

interface FakeApproval {
  id: string;
  workspaceId: string;
  projectId: string;
  type: MnApprovalType;
  requestedByUserId: string | null;
  payload: unknown;
  createdAt: Date;
}

interface FakePlan {
  id: string;
  taskId: string;
  revisionNumber: number;
  bodyMd: string;
  authorUserId: string | null;
  createdAt: Date;
}

function createFakeDb() {
  const conversations: FakeConversation[] = [];
  const turns: FakeTurn[] = [];
  const projects: FakeProject[] = [];
  const tasks: FakeTask[] = [];
  const approvals: FakeApproval[] = [];
  const plans: FakePlan[] = [];

  const db = {
    mnCeoConversation: {
      create: async ({ data }: { data: Partial<FakeConversation> }) => {
        const now = new Date();
        const row: FakeConversation = {
          id: data.id!,
          workspaceId: data.workspaceId!,
          ownerUserId: data.ownerUserId!,
          title: data.title ?? null,
          lastResolutionKind: null,
          createdAt: now,
          updatedAt: now,
        };
        conversations.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        conversations.find(c => c.id === where.id) ?? null,
      findMany: async ({
        where,
        orderBy: _orderBy,
      }: {
        where: { workspaceId: string };
        orderBy?: unknown;
      }) =>
        conversations
          .filter(c => c.workspaceId === where.workspaceId)
          .slice()
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeConversation>;
      }) => {
        const row = conversations.find(c => c.id === where.id);
        if (!row) throw new Error('conversation not found');
        Object.assign(row, data);
        row.updatedAt = new Date();
        return row;
      },
    },
    mnCeoTurn: {
      create: async ({ data }: { data: Partial<FakeTurn> }) => {
        const row: FakeTurn = {
          id: data.id!,
          conversationId: data.conversationId!,
          role: data.role!,
          bodyMd: data.bodyMd!,
          resolutionKind: data.resolutionKind ?? MnCeoResolutionKind.NONE,
          resolutionRefId: data.resolutionRefId ?? null,
          createdAt: new Date(),
        };
        turns.push(row);
        return row;
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { conversation?: boolean };
      }) => {
        const t = turns.find(x => x.id === where.id);
        if (!t) return null;
        if (include?.conversation) {
          const conv = conversations.find(c => c.id === t.conversationId);
          return { ...t, conversation: conv };
        }
        return t;
      },
      findMany: async ({
        where,
        orderBy: _orderBy,
      }: {
        where: { conversationId: string };
        orderBy?: unknown;
      }) =>
        turns
          .filter(t => t.conversationId === where.conversationId)
          .slice()
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeTurn>;
      }) => {
        const row = turns.find(t => t.id === where.id);
        if (!row) throw new Error('turn not found');
        Object.assign(row, data);
        return row;
      },
    },
    mnProject: {
      findFirst: async ({
        where,
        orderBy: _orderBy,
        select: _select,
      }: {
        where: { workspaceId: string };
        orderBy?: unknown;
        select?: unknown;
      }) =>
        projects
          .filter(p => p.workspaceId === where.workspaceId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ??
        null,
    },
    mnTask: {
      create: async ({ data }: { data: Partial<FakeTask> }) => {
        const row: FakeTask = {
          id: data.id!,
          projectId: data.projectId!,
          title: data.title!,
          description: data.description ?? null,
          createdByUserId: data.createdByUserId ?? null,
          createdAt: new Date(),
        };
        tasks.push(row);
        return row;
      },
    },
    mnApproval: {
      create: async ({ data }: { data: Partial<FakeApproval> }) => {
        const row: FakeApproval = {
          id: data.id!,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          type: data.type ?? MnApprovalType.APPROVE_TASK_COMPLETION,
          requestedByUserId: data.requestedByUserId ?? null,
          payload: data.payload ?? {},
          createdAt: new Date(),
        };
        approvals.push(row);
        return row;
      },
    },
    mnTaskPlan: {
      create: async ({ data }: { data: Partial<FakePlan> }) => {
        const row: FakePlan = {
          id: data.id!,
          taskId: data.taskId!,
          revisionNumber: data.revisionNumber ?? 1,
          bodyMd: data.bodyMd!,
          authorUserId: data.authorUserId ?? null,
          createdAt: new Date(),
        };
        plans.push(row);
        return row;
      },
    },
  };

  return {
    db,
    conversations,
    turns,
    projects,
    tasks,
    approvals,
    plans,
  };
}

function makeService(
  db: ReturnType<typeof createFakeDb>['db']
): MnCeoChatService {
  return new MnCeoChatService(
    db as unknown as ConstructorParameters<typeof MnCeoChatService>[0]
  );
}

test('classifyIntent maps "create task" → TASK_CREATED', t => {
  const svc = makeService(createFakeDb().db);
  t.is(
    svc.classifyIntent('Please create a task for the launch checklist.'),
    MnCeoResolutionKind.TASK_CREATED
  );
});

test('classifyIntent maps "approve" → APPROVAL_REQUESTED', t => {
  const svc = makeService(createFakeDb().db);
  t.is(
    svc.classifyIntent('I want to approve the new design budget.'),
    MnCeoResolutionKind.APPROVAL_REQUESTED
  );
});

test('classifyIntent maps "draft plan" → PLAN_DRAFTED', t => {
  const svc = makeService(createFakeDb().db);
  t.is(
    svc.classifyIntent('Please draft a plan for the Q3 GTM motion.'),
    MnCeoResolutionKind.PLAN_DRAFTED
  );
});

test('classifyIntent maps "decide" → DECISION_RECORDED', t => {
  const svc = makeService(createFakeDb().db);
  t.is(
    svc.classifyIntent('Let me decide on the pricing tier today.'),
    MnCeoResolutionKind.DECISION_RECORDED
  );
});

test('classifyIntent maps "budget" → BUDGET_QUERY', t => {
  const svc = makeService(createFakeDb().db);
  t.is(
    svc.classifyIntent("What's the budget for marketing this quarter?"),
    MnCeoResolutionKind.BUDGET_QUERY
  );
});

test('classifyIntent maps "status" → STATUS_QUERY', t => {
  const svc = makeService(createFakeDb().db);
  t.is(
    svc.classifyIntent('Give me a status update on the migration.'),
    MnCeoResolutionKind.STATUS_QUERY
  );
});

test('classifyIntent maps non-matching bodies → NONE', t => {
  const svc = makeService(createFakeDb().db);
  t.is(
    svc.classifyIntent('Hello there, hope you are well.'),
    MnCeoResolutionKind.NONE
  );
});

test('createConversation rejects empty workspaceId', async t => {
  const svc = makeService(createFakeDb().db);
  await t.throwsAsync(svc.createConversation('', 'u1'), {
    instanceOf: BadRequestException,
  });
});

test('createConversation rejects empty ownerUserId', async t => {
  const svc = makeService(createFakeDb().db);
  await t.throwsAsync(svc.createConversation('w1', ''), {
    instanceOf: BadRequestException,
  });
});

test('addTurn appends + refuses missing conversations', async t => {
  const fixture = createFakeDb();
  const svc = makeService(fixture.db);
  const conv = await svc.createConversation('w1', 'u1');
  const turn = await svc.addTurn(conv.id, MnCeoTurnRole.USER, 'hello');
  t.is(turn.role, MnCeoTurnRole.USER);
  t.is(fixture.turns.length, 1);
  await t.throwsAsync(svc.addTurn('missing-id', MnCeoTurnRole.USER, 'hello'), {
    instanceOf: NotFoundException,
  });
});

test('addTurn rejects empty body', async t => {
  const fixture = createFakeDb();
  const svc = makeService(fixture.db);
  const conv = await svc.createConversation('w1', 'u1');
  await t.throwsAsync(svc.addTurn(conv.id, MnCeoTurnRole.USER, '   '), {
    instanceOf: BadRequestException,
  });
});

test('resolveIntent creates MnTask + links it on the turn when intent=TASK_CREATED', async t => {
  const fixture = createFakeDb();
  fixture.projects.push({
    id: 'p1',
    workspaceId: 'w1',
    createdAt: new Date('2026-01-01'),
  });
  const svc = makeService(fixture.db);
  const conv = await svc.createConversation('w1', 'u1');
  const userTurn = await svc.addTurn(
    conv.id,
    MnCeoTurnRole.USER,
    'create a task to ship the landing page hero'
  );
  const resolved = await svc.resolveIntent(userTurn.id);
  t.is(resolved.resolutionKind, MnCeoResolutionKind.TASK_CREATED);
  t.is(fixture.tasks.length, 1);
  t.is(resolved.resolutionRefId, fixture.tasks[0]!.id);
  t.is(fixture.tasks[0]!.projectId, 'p1');
  t.is(fixture.tasks[0]!.createdByUserId, 'u1');
});

test('resolveIntent creates MnApproval when intent=APPROVAL_REQUESTED', async t => {
  const fixture = createFakeDb();
  fixture.projects.push({
    id: 'p1',
    workspaceId: 'w1',
    createdAt: new Date('2026-01-01'),
  });
  const svc = makeService(fixture.db);
  const conv = await svc.createConversation('w1', 'u1');
  const userTurn = await svc.addTurn(
    conv.id,
    MnCeoTurnRole.USER,
    'please approve the design budget for Q3'
  );
  const resolved = await svc.resolveIntent(userTurn.id);
  t.is(resolved.resolutionKind, MnCeoResolutionKind.APPROVAL_REQUESTED);
  t.is(fixture.approvals.length, 1);
  t.is(resolved.resolutionRefId, fixture.approvals[0]!.id);
});

test('resolveIntent short-circuits CEO_AGENT turns', async t => {
  const fixture = createFakeDb();
  const svc = makeService(fixture.db);
  const conv = await svc.createConversation('w1', 'u1');
  const agentTurn = await svc.addTurn(
    conv.id,
    MnCeoTurnRole.CEO_AGENT,
    'create a task — but this is an agent statement'
  );
  const resolved = await svc.resolveIntent(agentTurn.id);
  // The service must not classify nor link a work object on a CEO turn.
  t.is(resolved.resolutionKind, MnCeoResolutionKind.NONE);
  t.is(resolved.resolutionRefId, null);
  t.is(fixture.tasks.length, 0);
});

test('getConversation enforces the workspace fence', async t => {
  const fixture = createFakeDb();
  const svc = makeService(fixture.db);
  const conv = await svc.createConversation('w1', 'u1');
  const hit = await svc.getConversation('w1', conv.id);
  t.truthy(hit);
  const miss = await svc.getConversation('w2', conv.id);
  t.is(miss, null);
});
