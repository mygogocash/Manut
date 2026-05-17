/**
 * MnGoalContextService.taskAncestry + MnGoalService cycle guards on tasks.
 *
 * Covers M2.2 — task ancestry, parent task cycle prevention, blocker
 * uniqueness, and the XOR enforcement on user vs agent assignee.
 *
 * All tests use the in-memory Prisma stub; no DB required.
 */

import { BadRequestException } from '@nestjs/common';
import { MnGoalLevel, MnGoalStatus } from '@prisma/client';
import test from 'ava';

import { MAX_TASK_CHAIN_DEPTH } from '../../plugins/manut/manut-goal.dto';
import { MnGoalService } from '../../plugins/manut/manut-goal.service';
import { MnGoalContextService } from '../../plugins/manut/manut-goal-context.service';

interface FakeTask {
  id: string;
  projectId: string;
  title: string;
  parentTaskId: string | null;
  goalId: string | null;
  assigneeUserId: string | null;
  assigneeAgentId: string | null;
}

interface FakeBlocker {
  id: string;
  taskId: string;
  blockedByTaskId: string;
  projectId: string;
  createdAt: Date;
}

function createFakeDb() {
  const projects: { id: string; workspaceId: string }[] = [];
  const tasks: FakeTask[] = [];
  const blockers: FakeBlocker[] = [];
  const goals: {
    id: string;
    workspaceId: string;
    projectId: string;
    title: string;
    description: string | null;
    level: MnGoalLevel;
    parentGoalId: string | null;
    ownerAgentId: string | null;
    status: MnGoalStatus;
  }[] = [];

  const db = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.find(p => p.id === where.id) ?? null,
    },
    mnTask: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        tasks.find(t => t.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeTask>;
      }) => {
        const idx = tasks.findIndex(t => t.id === where.id);
        if (idx < 0) throw new Error('not found');
        tasks[idx] = { ...tasks[idx], ...data };
        return tasks[idx];
      },
    },
    mnTaskBlocker: {
      findUnique: async ({
        where,
      }: {
        where: {
          taskId_blockedByTaskId: { taskId: string; blockedByTaskId: string };
        };
      }) =>
        blockers.find(
          b =>
            b.taskId === where.taskId_blockedByTaskId.taskId &&
            b.blockedByTaskId === where.taskId_blockedByTaskId.blockedByTaskId
        ) ?? null,
      findMany: async ({ where }: { where: { taskId: string } }) =>
        blockers.filter(b => b.taskId === where.taskId),
      create: async ({
        data,
      }: {
        data: Partial<FakeBlocker> & { id: string };
      }) => {
        const row: FakeBlocker = {
          id: data.id,
          taskId: data.taskId!,
          blockedByTaskId: data.blockedByTaskId!,
          projectId: data.projectId!,
          createdAt: new Date(),
        };
        blockers.push(row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = blockers.findIndex(b => b.id === where.id);
        if (idx < 0) throw new Error('not found');
        const [r] = blockers.splice(idx, 1);
        return r;
      },
    },
    mnGoal: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        goals.find(g => g.id === where.id) ?? null,
    },
  };

  return { db, projects, tasks, blockers, goals };
}

test('addParentTask rejects when parent would create a cycle', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  // a is parent of b is parent of c. Setting a.parent = c would loop.
  fake.tasks.push(
    {
      id: 'a',
      projectId: 'project-1',
      title: 'A',
      parentTaskId: null,
      goalId: null,
      assigneeUserId: null,
      assigneeAgentId: null,
    },
    {
      id: 'b',
      projectId: 'project-1',
      title: 'B',
      parentTaskId: 'a',
      goalId: null,
      assigneeUserId: null,
      assigneeAgentId: null,
    },
    {
      id: 'c',
      projectId: 'project-1',
      title: 'C',
      parentTaskId: 'b',
      goalId: null,
      assigneeUserId: null,
      assigneeAgentId: null,
    }
  );

  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(() => svc.setTaskParent('workspace-1', 'a', 'c'), {
    instanceOf: BadRequestException,
    message: /cycle/i,
  });
});

test('addParentTask rejects self-parent', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  fake.tasks.push({
    id: 'a',
    projectId: 'project-1',
    title: 'A',
    parentTaskId: null,
    goalId: null,
    assigneeUserId: null,
    assigneeAgentId: null,
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(() => svc.setTaskParent('workspace-1', 'a', 'a'), {
    instanceOf: BadRequestException,
    message: /itself/i,
  });
});

test('addParentTask rejects chains exceeding MAX_TASK_CHAIN_DEPTH', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  // Build a long chain.
  for (let i = 0; i < MAX_TASK_CHAIN_DEPTH; i++) {
    fake.tasks.push({
      id: `t-${i}`,
      projectId: 'project-1',
      title: `T${i}`,
      parentTaskId: i === 0 ? null : `t-${i - 1}`,
      goalId: null,
      assigneeUserId: null,
      assigneeAgentId: null,
    });
  }
  fake.tasks.push({
    id: 'leaf',
    projectId: 'project-1',
    title: 'Leaf',
    parentTaskId: null,
    goalId: null,
    assigneeUserId: null,
    assigneeAgentId: null,
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.setTaskParent('workspace-1', 'leaf', `t-${MAX_TASK_CHAIN_DEPTH - 1}`),
    { instanceOf: BadRequestException, message: /depth/i }
  );
});

test('addTaskBlocker refuses duplicates (uniqueness constraint at service)', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  fake.tasks.push(
    {
      id: 'a',
      projectId: 'project-1',
      title: 'A',
      parentTaskId: null,
      goalId: null,
      assigneeUserId: null,
      assigneeAgentId: null,
    },
    {
      id: 'b',
      projectId: 'project-1',
      title: 'B',
      parentTaskId: null,
      goalId: null,
      assigneeUserId: null,
      assigneeAgentId: null,
    }
  );
  const svc = new MnGoalService(fake.db as any);

  await svc.addTaskBlocker('workspace-1', 'a', 'b');

  await t.throwsAsync(() => svc.addTaskBlocker('workspace-1', 'a', 'b'), {
    instanceOf: BadRequestException,
    message: /already/i,
  });
});

test('addTaskBlocker rejects self-block', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  fake.tasks.push({
    id: 'a',
    projectId: 'project-1',
    title: 'A',
    parentTaskId: null,
    goalId: null,
    assigneeUserId: null,
    assigneeAgentId: null,
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(() => svc.addTaskBlocker('workspace-1', 'a', 'a'), {
    instanceOf: BadRequestException,
    message: /itself/i,
  });
});

test('assignTask rejects both user and agent assignees set (XOR)', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  fake.tasks.push({
    id: 'a',
    projectId: 'project-1',
    title: 'A',
    parentTaskId: null,
    goalId: null,
    assigneeUserId: null,
    assigneeAgentId: null,
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.assignTask('workspace-1', 'a', {
        userId: 'user-1',
        agentId: 'agent-1',
      }),
    { instanceOf: BadRequestException, message: /one/i }
  );
});

test('assignTask permits clearing both assignees', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  fake.tasks.push({
    id: 'a',
    projectId: 'project-1',
    title: 'A',
    parentTaskId: null,
    goalId: null,
    assigneeUserId: 'user-x',
    assigneeAgentId: null,
  });
  const svc = new MnGoalService(fake.db as any);

  const row = await svc.assignTask('workspace-1', 'a', {
    userId: null,
    agentId: null,
  });

  t.is(row.assigneeUserId, null);
  t.is(row.assigneeAgentId, null);
});

test('taskAncestry returns ancestors root → leaf and goal chain', async t => {
  const fake = createFakeDb();
  fake.projects.push({ id: 'project-1', workspaceId: 'workspace-1' });
  fake.goals.push(
    {
      id: 'goal-root',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      title: 'Strategy',
      description: null,
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
      description: null,
      level: MnGoalLevel.TEAM,
      parentGoalId: 'goal-root',
      ownerAgentId: null,
      status: MnGoalStatus.ACTIVE,
    }
  );
  fake.tasks.push(
    {
      id: 'parent',
      projectId: 'project-1',
      title: 'Parent Task',
      parentTaskId: null,
      goalId: 'goal-leaf',
      assigneeUserId: null,
      assigneeAgentId: null,
    },
    {
      id: 'child',
      projectId: 'project-1',
      title: 'Child Task',
      parentTaskId: 'parent',
      goalId: null,
      assigneeUserId: null,
      assigneeAgentId: null,
    }
  );
  const goalSvc = new MnGoalService(fake.db as any);
  const ctxSvc = new MnGoalContextService(fake.db as any, goalSvc);

  const ancestry = await ctxSvc.taskAncestry('workspace-1', 'child');
  if (!ancestry) {
    t.fail('expected ancestry to be non-null for child task');
    return;
  }

  t.is(ancestry.taskId, 'child');
  t.is(ancestry.taskTitle, 'Child Task');
  t.deepEqual(
    ancestry.taskAncestors.map(a => a.taskId),
    ['parent']
  );
  // Child has no direct goal; it inherits via parent's goal-leaf
  t.deepEqual(
    ancestry.goalChain.map(g => g.goalId),
    ['goal-root', 'goal-leaf']
  );
});
