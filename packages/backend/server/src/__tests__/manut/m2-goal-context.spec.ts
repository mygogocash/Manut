/**
 * MnGoalContextService.buildContext — output bounded by 500 chars,
 * truncates from the leaf end with " … [truncated]", logs a warning
 * when the assembled context would exceed the cap.
 *
 * Pure logic — no DB writes — so all stubs are trivial.
 */

import { Logger } from '@nestjs/common';
import { MnGoalLevel, MnGoalStatus } from '@prisma/client';
import test from 'ava';

import {
  GOAL_CONTEXT_CHAR_CAP,
  MAX_GOAL_CHAIN_DEPTH,
} from '../../plugins/manut/manut-goal.dto';
import { MnGoalService } from '../../plugins/manut/manut-goal.service';
import { MnGoalContextService } from '../../plugins/manut/manut-goal-context.service';

function createStub() {
  const projects: { id: string; workspaceId: string }[] = [
    { id: 'project-1', workspaceId: 'workspace-1' },
  ];
  const goals: any[] = [];
  const tasks: any[] = [];

  const db = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.find(p => p.id === where.id) ?? null,
    },
    mnGoal: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        goals.find(g => g.id === where.id) ?? null,
    },
    mnTask: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        tasks.find(t => t.id === where.id) ?? null,
    },
    mnAgent: {
      findUnique: async () => null,
    },
  };

  return { db, projects, goals, tasks };
}

test('buildContext returns null when task has no goal or parent', async t => {
  const stub = createStub();
  stub.tasks.push({
    id: 'task-1',
    projectId: 'project-1',
    title: 'Floating task',
    parentTaskId: null,
    goalId: null,
  });
  const goalSvc = new MnGoalService(stub.db as any);
  const svc = new MnGoalContextService(stub.db as any, goalSvc);

  t.is(await svc.buildContext('task-1'), null);
});

test('buildContext renders root→leaf chain for a goal-linked task', async t => {
  const stub = createStub();
  stub.goals.push(
    {
      id: 'goal-root',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      title: 'Strategy',
      level: MnGoalLevel.PROJECT,
      parentGoalId: null,
      ownerAgentId: null,
      status: MnGoalStatus.ACTIVE,
    },
    {
      id: 'goal-leaf',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      title: 'Tactic',
      level: MnGoalLevel.TEAM,
      parentGoalId: 'goal-root',
      ownerAgentId: null,
      status: MnGoalStatus.ACTIVE,
    }
  );
  stub.tasks.push({
    id: 'task-1',
    projectId: 'project-1',
    title: 'Build it',
    parentTaskId: null,
    goalId: 'goal-leaf',
  });
  const goalSvc = new MnGoalService(stub.db as any);
  const svc = new MnGoalContextService(stub.db as any, goalSvc);

  const out = await svc.buildContext('task-1');

  t.truthy(out);
  // The header marker must be present so consumers can detect the block.
  t.regex(out!, /GOAL CONTEXT/);
  // The chain order must show root before leaf.
  const rootIdx = out!.indexOf('Strategy');
  const leafIdx = out!.indexOf('Tactic');
  t.true(rootIdx > -1 && leafIdx > -1 && rootIdx < leafIdx);
  // The current task title is included.
  t.regex(out!, /Build it/);
});

test('buildContext truncates output longer than GOAL_CONTEXT_CHAR_CAP', async t => {
  const stub = createStub();
  // Stack the chain so every step has a long title — forces the
  // assembled string past the cap.
  const longTitle = 'X'.repeat(200);
  for (let i = 0; i < MAX_GOAL_CHAIN_DEPTH; i++) {
    stub.goals.push({
      id: `g-${i}`,
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      title: `${longTitle}-${i}`,
      level: MnGoalLevel.PROJECT,
      parentGoalId: i === 0 ? null : `g-${i - 1}`,
      ownerAgentId: null,
      status: MnGoalStatus.ACTIVE,
    });
  }
  stub.tasks.push({
    id: 'task-1',
    projectId: 'project-1',
    title: longTitle,
    parentTaskId: null,
    goalId: `g-${MAX_GOAL_CHAIN_DEPTH - 1}`,
  });
  const goalSvc = new MnGoalService(stub.db as any);
  const svc = new MnGoalContextService(stub.db as any, goalSvc);

  // Spy on the logger.
  const warnings: string[] = [];
  const origWarn = Logger.prototype.warn;
  Logger.prototype.warn = function (msg: any) {
    warnings.push(String(msg));
  };
  try {
    const out = await svc.buildContext('task-1');
    t.truthy(out);
    t.true(
      out!.length <= GOAL_CONTEXT_CHAR_CAP,
      `expected output ≤ ${GOAL_CONTEXT_CHAR_CAP} chars, got ${out!.length}`
    );
    t.regex(out!, /truncated/);
    t.true(
      warnings.some(w => /goal[- ]context/i.test(w) && /truncated/i.test(w)),
      `expected a truncation warning to be logged, got ${warnings.join('|')}`
    );
  } finally {
    Logger.prototype.warn = origWarn;
  }
});

test('buildContext returns null when taskId is missing', async t => {
  const stub = createStub();
  const goalSvc = new MnGoalService(stub.db as any);
  const svc = new MnGoalContextService(stub.db as any, goalSvc);

  t.is(await svc.buildContext('nonexistent-task'), null);
});
