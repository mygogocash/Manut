import { MnApprovalStatus, MnApprovalType } from '@prisma/client';
import test from 'ava';

import { MnApprovalService } from '../../plugins/manut/manut-approval.service';
import { MnApprovalGateService } from '../../plugins/manut/manut-approval-gate.service';
import { MnApprovalStaleCron } from '../../plugins/manut/manut-approval-stale.cron';

/**
 * M3 stale-pending auto-cancellation cron.
 *
 * The cron runs every 5 minutes. Each tick scans every workspace
 * with at least one PENDING row and bulk-cancels any PENDING approval
 * older than the workspace's `approvalTimeoutMinutes` (default 30).
 *
 * We drive the cron via `runOnce(now)` so the test controls the
 * clock explicitly — no Date.now() mocking, no real timers.
 */

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
  const approvals: FakeApproval[] = [];
  const db = {
    mnProject: {
      findUnique: async () => null,
    },
    mnAgent: {
      findUnique: async () => null,
    },
    mnApproval: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        approvals.find(a => a.id === where.id) ?? null,
      findMany: async ({
        where,
        select: _select,
        take,
      }: {
        where?: { status?: MnApprovalStatus };
        select?: { workspaceId?: boolean };
        take?: number;
      } = {}) => {
        let rows = approvals.slice();
        if (where?.status) {
          rows = rows.filter(a => a.status === where.status);
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows.map(a => ({ workspaceId: a.workspaceId }));
      },
      count: async ({
        where,
      }: {
        where: { workspaceId: string; status: { in: MnApprovalStatus[] } };
      }) =>
        approvals.filter(
          a =>
            a.workspaceId === where.workspaceId &&
            where.status.in.includes(a.status)
        ).length,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeApproval>;
      }) => {
        const idx = approvals.findIndex(a => a.id === where.id);
        if (idx < 0) throw new Error('not found');
        approvals[idx] = { ...approvals[idx], ...data, updatedAt: new Date() };
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
          approvals[i] = { ...a, ...data, updatedAt: new Date() };
          count += 1;
        }
        return { count };
      },
      create: async () => {
        throw new Error('create not used by stale cron');
      },
    },
  };
  return { db, approvals };
}

function seedApproval(
  store: { approvals: FakeApproval[] },
  partial: Partial<FakeApproval> & {
    id: string;
    workspaceId: string;
    createdAt: Date;
  }
) {
  store.approvals.push({
    id: partial.id,
    workspaceId: partial.workspaceId,
    projectId: partial.projectId ?? 'project-1',
    type: partial.type ?? MnApprovalType.HIRE_AGENT,
    requestedByAgentId: partial.requestedByAgentId ?? null,
    requestedByUserId: partial.requestedByUserId ?? null,
    status: partial.status ?? MnApprovalStatus.PENDING,
    payload: partial.payload ?? {},
    decisionNote: partial.decisionNote ?? null,
    decidedByUserId: partial.decidedByUserId ?? null,
    decidedAt: partial.decidedAt ?? null,
    createdAt: partial.createdAt,
    updatedAt: partial.updatedAt ?? partial.createdAt,
  });
}

function makeCron() {
  const fake = createFakeDb();
  const gate = new MnApprovalGateService();
  const svc = new MnApprovalService(fake.db as never, gate);
  const cron = new MnApprovalStaleCron(fake.db as never, svc);
  return { fake, cron, svc, gate };
}

test('runOnce cancels PENDING approvals older than 30 minutes', async t => {
  const { fake, cron } = makeCron();
  const now = new Date('2026-05-17T12:00:00Z');
  seedApproval(fake, {
    id: 'stale',
    workspaceId: 'workspace-1',
    createdAt: new Date('2026-05-17T11:00:00Z'), // 60 min ago
    status: MnApprovalStatus.PENDING,
  });
  seedApproval(fake, {
    id: 'fresh',
    workspaceId: 'workspace-1',
    createdAt: new Date('2026-05-17T11:55:00Z'), // 5 min ago
    status: MnApprovalStatus.PENDING,
  });
  const result = await cron.runOnce(now);
  t.is(result.workspacesScanned, 1);
  t.is(result.cancelledCount, 1);
  const stale = fake.approvals.find(a => a.id === 'stale')!;
  t.is(stale.status, MnApprovalStatus.CANCELLED);
  t.is(stale.decisionNote, 'Auto-cancelled: pending approval exceeded timeout');
  const fresh = fake.approvals.find(a => a.id === 'fresh')!;
  t.is(fresh.status, MnApprovalStatus.PENDING);
});

test('runOnce ignores already-decided approvals even if old', async t => {
  const { fake, cron } = makeCron();
  const now = new Date('2026-05-17T12:00:00Z');
  seedApproval(fake, {
    id: 'old-approved',
    workspaceId: 'workspace-1',
    createdAt: new Date('2026-05-17T10:00:00Z'), // 120 min ago
    status: MnApprovalStatus.APPROVED,
    decidedAt: new Date('2026-05-17T10:30:00Z'),
    decidedByUserId: 'user-1',
  });
  const result = await cron.runOnce(now);
  // No PENDING rows in this workspace, so groupBy returns empty.
  t.is(result.workspacesScanned, 0);
  t.is(result.cancelledCount, 0);
  const row = fake.approvals.find(a => a.id === 'old-approved')!;
  t.is(row.status, MnApprovalStatus.APPROVED);
});

test('runOnce ignores REVISION_REQUESTED rows (still actionable)', async t => {
  const { fake, cron } = makeCron();
  const now = new Date('2026-05-17T12:00:00Z');
  seedApproval(fake, {
    id: 'rev',
    workspaceId: 'workspace-1',
    createdAt: new Date('2026-05-17T10:00:00Z'),
    status: MnApprovalStatus.REVISION_REQUESTED,
  });
  const result = await cron.runOnce(now);
  t.is(result.cancelledCount, 0);
  const row = fake.approvals.find(a => a.id === 'rev')!;
  t.is(row.status, MnApprovalStatus.REVISION_REQUESTED);
});

test('runOnce handles multiple workspaces independently', async t => {
  const { fake, cron } = makeCron();
  const now = new Date('2026-05-17T12:00:00Z');
  seedApproval(fake, {
    id: 'ws1-stale',
    workspaceId: 'workspace-1',
    createdAt: new Date('2026-05-17T11:00:00Z'),
  });
  seedApproval(fake, {
    id: 'ws2-stale',
    workspaceId: 'workspace-2',
    createdAt: new Date('2026-05-17T10:30:00Z'),
  });
  seedApproval(fake, {
    id: 'ws2-fresh',
    workspaceId: 'workspace-2',
    createdAt: new Date('2026-05-17T11:50:00Z'),
  });
  const result = await cron.runOnce(now);
  t.is(result.workspacesScanned, 2);
  t.is(result.cancelledCount, 2);
});

test('runOnce continues after one workspace fails', async t => {
  const { fake, cron, svc } = makeCron();
  const now = new Date('2026-05-17T12:00:00Z');
  seedApproval(fake, {
    id: 'a',
    workspaceId: 'workspace-bad',
    createdAt: new Date('2026-05-17T11:00:00Z'),
  });
  seedApproval(fake, {
    id: 'b',
    workspaceId: 'workspace-good',
    createdAt: new Date('2026-05-17T11:00:00Z'),
  });
  // Force the first workspace's cancel call to throw, the second to succeed.
  const orig = svc.cancelPendingOlderThan.bind(svc);
  svc.cancelPendingOlderThan = async (ws, cutoff) => {
    if (ws === 'workspace-bad') throw new Error('boom');
    return orig(ws, cutoff);
  };
  const result = await cron.runOnce(now);
  // Both workspaces scanned, only the good one counted.
  t.is(result.workspacesScanned, 2);
  t.is(result.cancelledCount, 1);
});

test('runOnce invalidates the gate cache after cancellations', async t => {
  const { fake, cron, gate } = makeCron();
  gate.set('workspace-1', 1); // pretend 1 pending
  t.is(gate.peek('workspace-1'), true);
  const now = new Date('2026-05-17T12:00:00Z');
  seedApproval(fake, {
    id: 'stale',
    workspaceId: 'workspace-1',
    createdAt: new Date('2026-05-17T11:00:00Z'),
  });
  await cron.runOnce(now);
  t.is(gate.peek('workspace-1'), null);
});
