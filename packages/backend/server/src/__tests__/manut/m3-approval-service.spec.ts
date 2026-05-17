import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnApprovalStatus, MnApprovalType } from '@prisma/client';
import test from 'ava';

import { MnApprovalService } from '../../plugins/manut/manut-approval.service';
import { MnApprovalGateService } from '../../plugins/manut/manut-approval-gate.service';

/**
 * M3 approval service — state machine + invariants.
 *
 * Uses a hand-rolled in-memory Prisma stub so the tests can run
 * without a real Postgres. The stub keeps the same three tables the
 * service touches (mnApproval, mnProject, mnAgent) and the methods we
 * actually call.
 *
 * Pattern intentionally mirrors `mn-agent-service.spec.ts` — keep the
 * shape consistent so the M3 test reads like the M1 test does.
 */

interface FakeProject {
  id: string;
  workspaceId: string;
}
interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
}
interface FakeApproval {
  id: string;
  workspaceId: string;
  projectId: string;
  type: MnApprovalType;
  requestedByAgentId: string | null;
  requestedByUserId: string | null;
  status: MnApprovalStatus;
  payload: Record<string, unknown>;
  decisionNote: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const projects: FakeProject[] = [];
  const agents: FakeAgent[] = [];
  const approvals: FakeApproval[] = [];

  const db = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.find(p => p.id === where.id) ?? null,
    },
    mnAgent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        agents.find(a => a.id === where.id) ?? null,
    },
    mnApproval: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        approvals.find(a => a.id === where.id) ?? null,
      findMany: async ({
        where,
        take,
      }: {
        where: {
          workspaceId: string;
          projectId?: string;
          status?: { in?: MnApprovalStatus[] };
          type?: { in?: MnApprovalType[] };
          requestedByAgentId?: string;
        };
        orderBy?: unknown;
        take?: number;
      }) => {
        let rows = approvals.filter(a => a.workspaceId === where.workspaceId);
        if (where.projectId) {
          rows = rows.filter(a => a.projectId === where.projectId);
        }
        if (where.status?.in && where.status.in.length) {
          rows = rows.filter(a => where.status!.in!.includes(a.status));
        }
        if (where.type?.in && where.type.in.length) {
          rows = rows.filter(a => where.type!.in!.includes(a.type));
        }
        if (where.requestedByAgentId) {
          rows = rows.filter(
            a => a.requestedByAgentId === where.requestedByAgentId
          );
        }
        rows = rows
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      },
      count: async ({
        where,
      }: {
        where: { workspaceId: string; status: { in: MnApprovalStatus[] } };
      }) => {
        return approvals.filter(
          a =>
            a.workspaceId === where.workspaceId &&
            where.status.in.includes(a.status)
        ).length;
      },
      create: async ({
        data,
      }: {
        data: Partial<FakeApproval> & { id: string };
      }) => {
        const now = new Date();
        const row: FakeApproval = {
          id: data.id,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          type: data.type!,
          requestedByAgentId: data.requestedByAgentId ?? null,
          requestedByUserId: data.requestedByUserId ?? null,
          status: data.status ?? MnApprovalStatus.PENDING,
          payload: (data.payload as Record<string, unknown>) ?? {},
          decisionNote: data.decisionNote ?? null,
          decidedByUserId: data.decidedByUserId ?? null,
          decidedAt: data.decidedAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        approvals.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeApproval>;
      }) => {
        const idx = approvals.findIndex(a => a.id === where.id);
        if (idx < 0) throw new Error('not found');
        approvals[idx] = {
          ...approvals[idx],
          ...data,
          updatedAt: new Date(),
        };
        return approvals[idx];
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          workspaceId: string;
          status: MnApprovalStatus;
          createdAt?: { lt: Date };
        };
        data: Partial<FakeApproval>;
      }) => {
        let count = 0;
        for (let i = 0; i < approvals.length; i++) {
          const a = approvals[i];
          if (a.workspaceId !== where.workspaceId) continue;
          if (a.status !== where.status) continue;
          if (where.createdAt?.lt && a.createdAt >= where.createdAt.lt)
            continue;
          approvals[i] = {
            ...a,
            ...data,
            updatedAt: new Date(),
          };
          count += 1;
        }
        return { count };
      },
    },
  };
  return { db, projects, agents, approvals };
}

function makeService() {
  const fake = createFakeDb();
  const gate = new MnApprovalGateService();
  const svc = new MnApprovalService(fake.db as never, gate);
  return { fake, svc, gate };
}

test('create persists a new PENDING approval', async t => {
  const { fake, svc } = makeService();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });

  const row = await svc.create('workspace-1', 'user-1', {
    projectId: 'project-1',
    type: MnApprovalType.TOOL_CALL_REVIEW,
    payload: { toolName: 'doc_edit' },
  });
  t.is(row.workspaceId, 'workspace-1');
  t.is(row.projectId, 'project-1');
  t.is(row.status, MnApprovalStatus.PENDING);
  t.is(row.type, MnApprovalType.TOOL_CALL_REVIEW);
  t.deepEqual(row.payload, { toolName: 'doc_edit' });
  t.is(row.requestedByUserId, 'user-1');
});

test('create rejects a project that belongs to another workspace', async t => {
  const { fake, svc } = makeService();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-other' });

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-1',
        type: MnApprovalType.HIRE_AGENT,
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('create rejects a requesting agent in another workspace', async t => {
  const { fake, svc } = makeService();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  fake.agents.push({
    id: 'agent-elsewhere',
    workspaceId: 'workspace-other',
    projectId: 'project-1',
  });

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-1',
        type: MnApprovalType.TOOL_CALL_REVIEW,
        requestedByAgentId: 'agent-elsewhere',
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('get returns null for an approval in another workspace (no info leak)', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push({
    id: 'a',
    workspaceId: 'workspace-other',
    projectId: 'project-1',
    type: MnApprovalType.HIRE_AGENT,
    requestedByAgentId: null,
    requestedByUserId: null,
    status: MnApprovalStatus.PENDING,
    payload: {},
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const row = await svc.get('workspace-1', 'a');
  t.is(row, null);
});

test('getOrThrow surfaces NotFoundException for missing approvals', async t => {
  const { svc } = makeService();
  await t.throwsAsync(() => svc.getOrThrow('workspace-1', 'nope'), {
    instanceOf: NotFoundException,
  });
});

test('decide transitions PENDING -> APPROVED and records decider', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push({
    id: 'a',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    type: MnApprovalType.TOOL_CALL_REVIEW,
    requestedByAgentId: null,
    requestedByUserId: null,
    status: MnApprovalStatus.PENDING,
    payload: {},
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const out = await svc.decide('workspace-1', 'a', 'user-7', {
    status: MnApprovalStatus.APPROVED,
    decisionNote: 'lgtm',
  });
  t.is(out.status, MnApprovalStatus.APPROVED);
  t.is(out.decidedByUserId, 'user-7');
  t.is(out.decisionNote, 'lgtm');
  t.truthy(out.decidedAt);
});

test('decide rejects mutation of an already-APPROVED row', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push({
    id: 'a',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    type: MnApprovalType.HIRE_AGENT,
    requestedByAgentId: null,
    requestedByUserId: null,
    status: MnApprovalStatus.APPROVED,
    payload: {},
    decisionNote: null,
    decidedByUserId: 'user-1',
    decidedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await t.throwsAsync(
    () =>
      svc.decide('workspace-1', 'a', 'user-2', {
        status: MnApprovalStatus.REJECTED,
      }),
    { instanceOf: BadRequestException, message: /immutable|APPROVED/i }
  );
});

test('decide REVISION_REQUESTED requires a decisionNote', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push({
    id: 'a',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    type: MnApprovalType.TOOL_CALL_REVIEW,
    requestedByAgentId: null,
    requestedByUserId: null,
    status: MnApprovalStatus.PENDING,
    payload: {},
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await t.throwsAsync(
    () =>
      svc.decide('workspace-1', 'a', 'user-1', {
        status: MnApprovalStatus.REVISION_REQUESTED,
      }),
    { instanceOf: BadRequestException, message: /decisionNote/i }
  );
});

test('submitRevision moves REVISION_REQUESTED back to PENDING and clears decision', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push({
    id: 'a',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    type: MnApprovalType.TOOL_CALL_REVIEW,
    requestedByAgentId: null,
    requestedByUserId: null,
    status: MnApprovalStatus.REVISION_REQUESTED,
    payload: { stale: true },
    decisionNote: 'fix the args',
    decidedByUserId: 'user-1',
    decidedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const out = await svc.submitRevision('workspace-1', 'a', { fresh: true });
  t.is(out.status, MnApprovalStatus.PENDING);
  t.is(out.decisionNote, null);
  t.is(out.decidedByUserId, null);
  t.is(out.decidedAt, null);
  t.deepEqual(out.payload, { fresh: true });
});

test('submitRevision rejects non-REVISION_REQUESTED approvals', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push({
    id: 'a',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    type: MnApprovalType.HIRE_AGENT,
    requestedByAgentId: null,
    requestedByUserId: null,
    status: MnApprovalStatus.PENDING,
    payload: {},
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await t.throwsAsync(() => svc.submitRevision('workspace-1', 'a'), {
    instanceOf: BadRequestException,
  });
});

test('cancelPendingOlderThan auto-cancels stale PENDING rows', async t => {
  const { fake, svc } = makeService();
  const oldDate = new Date(Date.now() - 60 * 60_000); // 60 min ago
  const recentDate = new Date(Date.now() - 5 * 60_000); // 5 min ago
  fake.approvals.push(
    {
      id: 'old',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      type: MnApprovalType.HIRE_AGENT,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.PENDING,
      payload: {},
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: oldDate,
      updatedAt: oldDate,
    },
    {
      id: 'recent',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      type: MnApprovalType.HIRE_AGENT,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.PENDING,
      payload: {},
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: recentDate,
      updatedAt: recentDate,
    }
  );
  const cutoff = new Date(Date.now() - 30 * 60_000);
  const count = await svc.cancelPendingOlderThan('workspace-1', cutoff);
  t.is(count, 1);
  const old = fake.approvals.find(a => a.id === 'old')!;
  t.is(old.status, MnApprovalStatus.CANCELLED);
  const recent = fake.approvals.find(a => a.id === 'recent')!;
  t.is(recent.status, MnApprovalStatus.PENDING);
});

test('list scopes to workspace and supports status + type filters', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push(
    {
      id: 'a',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      type: MnApprovalType.HIRE_AGENT,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.PENDING,
      payload: {},
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'b',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      type: MnApprovalType.TOOL_CALL_REVIEW,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.APPROVED,
      payload: {},
      decisionNote: null,
      decidedByUserId: 'u1',
      decidedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'c',
      workspaceId: 'workspace-other',
      projectId: 'project-2',
      type: MnApprovalType.HIRE_AGENT,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.PENDING,
      payload: {},
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );

  const all = await svc.list('workspace-1');
  t.is(all.length, 2);

  const onlyPending = await svc.list('workspace-1', {
    statuses: [MnApprovalStatus.PENDING],
  });
  t.is(onlyPending.length, 1);
  t.is(onlyPending[0].id, 'a');

  const onlyToolCall = await svc.list('workspace-1', {
    types: [MnApprovalType.TOOL_CALL_REVIEW],
  });
  t.is(onlyToolCall.length, 1);
  t.is(onlyToolCall[0].id, 'b');
});

test('pendingCountForWorkspace returns PENDING+REVISION_REQUESTED count', async t => {
  const { fake, svc } = makeService();
  fake.approvals.push(
    {
      id: 'a',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      type: MnApprovalType.HIRE_AGENT,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.PENDING,
      payload: {},
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'b',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      type: MnApprovalType.HIRE_AGENT,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.REVISION_REQUESTED,
      payload: {},
      decisionNote: 'wrong agent',
      decidedByUserId: 'u1',
      decidedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'c',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      type: MnApprovalType.HIRE_AGENT,
      requestedByAgentId: null,
      requestedByUserId: null,
      status: MnApprovalStatus.APPROVED,
      payload: {},
      decisionNote: null,
      decidedByUserId: 'u1',
      decidedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );
  const count = await svc.pendingCountForWorkspace('workspace-1');
  t.is(count, 2);
});

test('create invalidates the gate cache so the next peek refetches', async t => {
  const { fake, svc, gate } = makeService();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  // Prime the cache to "no pending".
  gate.set('workspace-1', 0);
  t.is(gate.peek('workspace-1'), false);
  await svc.create('workspace-1', null, {
    projectId: 'project-1',
    type: MnApprovalType.TOOL_CALL_REVIEW,
  });
  t.is(gate.peek('workspace-1'), null);
});
