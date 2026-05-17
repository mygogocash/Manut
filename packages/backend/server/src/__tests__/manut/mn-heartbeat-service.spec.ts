import {
  MnAgentAdapterType,
  MnAgentStatus,
  MnHeartbeatInvocationSource,
  MnHeartbeatRunStatus,
} from '@prisma/client';
import test from 'ava';

import { MnHeartbeatService } from '../../plugins/manut/manut-heartbeat.service';

interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
  status: MnAgentStatus;
  lastHeartbeatAt: Date | null;
  adapterType: MnAgentAdapterType;
}

interface FakeRun {
  id: string;
  workspaceId: string;
  projectId: string;
  agentId: string;
  invocationSource: MnHeartbeatInvocationSource;
  status: MnHeartbeatRunStatus;
  aiSessionId: string | null;
  externalRunId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
}

function makeFakeDb(agents: FakeAgent[]) {
  const runs: FakeRun[] = [];

  const db = {
    mnAgent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        agents.find(a => a.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeAgent>;
      }) => {
        const idx = agents.findIndex(a => a.id === where.id);
        if (idx < 0) throw new Error('not found');
        agents[idx] = { ...agents[idx], ...data };
        return agents[idx];
      },
    },
    mnHeartbeatRun: {
      findFirst: async ({
        where,
      }: {
        where: { agentId: string; externalRunId: string };
      }) =>
        runs.find(
          r =>
            r.agentId === where.agentId &&
            r.externalRunId === where.externalRunId
        ) ?? null,
      create: async ({ data }: { data: Partial<FakeRun> & { id: string } }) => {
        const row: FakeRun = {
          id: data.id,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          agentId: data.agentId!,
          invocationSource: data.invocationSource!,
          status: data.status!,
          aiSessionId: data.aiSessionId ?? null,
          externalRunId: data.externalRunId ?? null,
          startedAt: data.startedAt ?? new Date(),
          finishedAt: data.finishedAt ?? null,
          error: data.error ?? null,
        };
        runs.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRun>;
      }) => {
        const idx = runs.findIndex(r => r.id === where.id);
        if (idx < 0) throw new Error('not found');
        runs[idx] = { ...runs[idx], ...data };
        return runs[idx];
      },
    },
  };

  return { db, runs };
}

function seedAgent(): FakeAgent {
  return {
    id: 'agent-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    status: MnAgentStatus.IDLE,
    lastHeartbeatAt: null,
    adapterType: MnAgentAdapterType.COPILOT_CHAT_SESSION,
  };
}

test('recordTurn inserts a new heartbeat row on first call', async t => {
  const agents: FakeAgent[] = [seedAgent()];
  const fake = makeFakeDb(agents);
  const svc = new MnHeartbeatService(fake.db as any);

  const row = await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.RUNNING,
  });

  t.truthy(row);
  t.is(fake.runs.length, 1);
  t.is(fake.runs[0].externalRunId, 'msg-1');
  t.is(fake.runs[0].invocationSource, MnHeartbeatInvocationSource.CHAT_TURN);
});

test('recordTurn is idempotent on (agentId, externalRunId)', async t => {
  const agents: FakeAgent[] = [seedAgent()];
  const fake = makeFakeDb(agents);
  const svc = new MnHeartbeatService(fake.db as any);

  await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.RUNNING,
  });
  await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.SUCCEEDED,
  });

  t.is(fake.runs.length, 1, 'second call updates the existing row');
  t.is(fake.runs[0].status, MnHeartbeatRunStatus.SUCCEEDED);
  t.truthy(fake.runs[0].finishedAt, 'terminal status stamps finishedAt');
});

test('recordTurn flips agent status IDLE -> RUNNING when run starts', async t => {
  const agents: FakeAgent[] = [seedAgent()];
  const fake = makeFakeDb(agents);
  const svc = new MnHeartbeatService(fake.db as any);

  await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.RUNNING,
  });

  t.is(agents[0].status, MnAgentStatus.RUNNING);
  t.truthy(agents[0].lastHeartbeatAt);
});

test('recordTurn flips agent status RUNNING -> IDLE when run terminates', async t => {
  const agents: FakeAgent[] = [seedAgent()];
  agents[0] = { ...agents[0], status: MnAgentStatus.RUNNING };
  const fake = makeFakeDb(agents);
  const svc = new MnHeartbeatService(fake.db as any);

  await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.SUCCEEDED,
  });

  t.is(agents[0].status as MnAgentStatus, MnAgentStatus.IDLE);
});

test('recordTurn never resurrects a TERMINATED agent', async t => {
  const agents: FakeAgent[] = [seedAgent()];
  agents[0] = { ...agents[0], status: MnAgentStatus.TERMINATED };
  const fake = makeFakeDb(agents);
  const svc = new MnHeartbeatService(fake.db as any);

  await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.RUNNING,
  });

  t.is(
    agents[0].status,
    MnAgentStatus.TERMINATED,
    'TERMINATED is sticky — heartbeats do not flip it back'
  );
});

test('recordTurn does not flip status on a PAUSED agent', async t => {
  const agents: FakeAgent[] = [seedAgent()];
  agents[0] = { ...agents[0], status: MnAgentStatus.PAUSED };
  const fake = makeFakeDb(agents);
  const svc = new MnHeartbeatService(fake.db as any);

  await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.SUCCEEDED,
  });

  t.is(
    agents[0].status,
    MnAgentStatus.PAUSED,
    'terminal heartbeat does not override an explicit pause'
  );
});

test('recordTurn truncates long error blobs', async t => {
  const agents: FakeAgent[] = [seedAgent()];
  const fake = makeFakeDb(agents);
  const svc = new MnHeartbeatService(fake.db as any);
  const longError = 'x'.repeat(5000);

  await svc.recordTurn({
    agentId: 'agent-1',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.FAILED,
    error: longError,
  });

  t.is(fake.runs[0].error?.length, 2000);
});

test('recordTurn swallows errors (fire-and-forget contract)', async t => {
  const fake = makeFakeDb([]);
  const svc = new MnHeartbeatService(fake.db as any);

  // No agent matching agentId -> recordTurnUnsafe would throw,
  // but the fire-and-forget recordTurn returns null instead.
  const row = await svc.recordTurn({
    agentId: 'nonexistent',
    aiSessionId: 'session-1',
    externalRunId: 'msg-1',
    status: MnHeartbeatRunStatus.RUNNING,
  });

  t.is(row, null);
});

test('recordTurnUnsafe surfaces missing-agent errors', async t => {
  const fake = makeFakeDb([]);
  const svc = new MnHeartbeatService(fake.db as any);

  await t.throwsAsync(() =>
    svc.recordTurnUnsafe({
      agentId: 'nonexistent',
      aiSessionId: 'session-1',
      externalRunId: 'msg-1',
      status: MnHeartbeatRunStatus.RUNNING,
    })
  );
});

test('recordTurnUnsafe rejects missing externalRunId — required for chat-turn idempotency', async t => {
  const fake = makeFakeDb([seedAgent()]);
  const svc = new MnHeartbeatService(fake.db as any);

  await t.throwsAsync(() =>
    svc.recordTurnUnsafe({
      agentId: 'agent-1',
      aiSessionId: 'session-1',
      externalRunId: '',
      status: MnHeartbeatRunStatus.RUNNING,
    })
  );
});
