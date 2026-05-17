import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  AddMnTaskBlockerInput,
  CreateMnGoalInput,
  MnGoalAncestryStep,
  MnGoalObjectType,
  MnTaskAncestry,
  MnTaskAncestryStep,
  MnTaskBlockerObjectType,
  UpdateMnGoalInput,
} from './manut-goal.dto';
import { MnGoalService } from './manut-goal.service';
import { MnGoalContextService } from './manut-goal-context.service';

/**
 * GraphQL surface for the M2 goal hierarchy + task ancestry / blockers.
 *
 * Permission checks run BEFORE service calls so the service stays focused
 * on data invariants. The bind-AI-session-to-task mutation also lives here
 * (we don't want to spin up a whole resolver for one stitch operation).
 *
 * Every nullable @Field on the DTO uses explicit `() => Type` form per
 * CLAUDE.md §6.
 */
@Resolver(() => MnGoalObjectType)
export class MnGoalResolver {
  constructor(
    private readonly service: MnGoalService,
    private readonly contextService: MnGoalContextService,
    private readonly ac: AccessController,
    private readonly db: PrismaClient
  ) {}

  // ---------------------------------------------------------------------------
  // Goal CRUD
  // ---------------------------------------------------------------------------

  @Query(() => [MnGoalObjectType], {
    description:
      'List goals in a workspace, optionally filtered by project. Workspace.Read.',
  })
  async mnGoals(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('projectId', { type: () => ID, nullable: true })
    projectId?: string | null
  ): Promise<MnGoalObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.list(workspaceId, projectId ?? null) as Promise<
      MnGoalObjectType[]
    >;
  }

  @Query(() => MnGoalObjectType, {
    nullable: true,
    description: 'Fetch a single goal. Returns null when not in workspace.',
  })
  async mnGoal(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('goalId', { type: () => ID }) goalId: string
  ): Promise<MnGoalObjectType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.get(
      workspaceId,
      goalId
    ) as Promise<MnGoalObjectType | null>;
  }

  @Query(() => [MnGoalAncestryStep], {
    description: 'Walk parent chain of a goal, ordered root → leaf.',
  })
  async mnGoalAncestry(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('goalId', { type: () => ID }) goalId: string
  ): Promise<MnGoalAncestryStep[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const chain = await this.service.ancestryChain(workspaceId, goalId);
    return chain as MnGoalAncestryStep[];
  }

  @Query(() => MnTaskAncestry, {
    nullable: true,
    description:
      'Combined task + goal ancestry for the task detail breadcrumb.',
  })
  async mnTaskAncestry(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('taskId', { type: () => ID }) taskId: string
  ): Promise<MnTaskAncestry | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const result = await this.contextService.taskAncestry(workspaceId, taskId);
    if (!result) return null;
    return {
      taskId: result.taskId,
      taskTitle: result.taskTitle,
      taskAncestors: result.taskAncestors as MnTaskAncestryStep[],
      goalChain: result.goalChain as MnGoalAncestryStep[],
    };
  }

  @Mutation(() => MnGoalObjectType, {
    description: 'Create a goal. Requires Workspace.Settings.Update.',
  })
  async createMnGoal(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => CreateMnGoalInput })
    input: CreateMnGoalInput
  ): Promise<MnGoalObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.create(
      workspaceId,
      user.id,
      input
    ) as Promise<MnGoalObjectType>;
  }

  @Mutation(() => MnGoalObjectType, {
    description:
      'Patch an existing goal. Terminal statuses (ACHIEVED, CANCELLED) ' +
      'cannot be flipped back. Requires Workspace.Settings.Update.',
  })
  async updateMnGoal(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('goalId', { type: () => ID }) goalId: string,
    @Args('input', { type: () => UpdateMnGoalInput })
    input: UpdateMnGoalInput
  ): Promise<MnGoalObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.update(
      workspaceId,
      goalId,
      input
    ) as Promise<MnGoalObjectType>;
  }

  @Mutation(() => Boolean, {
    description: 'Delete a goal. Linked tasks survive (goalId set to null).',
  })
  async deleteMnGoal(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('goalId', { type: () => ID }) goalId: string
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.delete(workspaceId, goalId);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Task parent + blockers + assignee XOR
  // ---------------------------------------------------------------------------

  @Mutation(() => Boolean, {
    description:
      'Set or clear a task parent. Rejects self-parent, cycles, and ' +
      'chains deeper than the configured cap.',
  })
  async setMnTaskParent(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('parentTaskId', { type: () => ID, nullable: true })
    parentTaskId?: string | null
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.setTaskParent(workspaceId, taskId, parentTaskId ?? null);
    return true;
  }

  @Mutation(() => MnTaskBlockerObjectType, {
    description: 'Mark one task as blocked by another. Rejects self-block.',
  })
  async addMnTaskBlocker(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => AddMnTaskBlockerInput })
    input: AddMnTaskBlockerInput
  ): Promise<MnTaskBlockerObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.addTaskBlocker(
      workspaceId,
      input.taskId,
      input.blockedByTaskId
    ) as Promise<MnTaskBlockerObjectType>;
  }

  @Mutation(() => Boolean, {
    description: 'Remove a task blocker edge. No-op when the edge is gone.',
  })
  async removeMnTaskBlocker(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('blockerId', { type: () => ID }) blockerId: string
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.removeTaskBlocker(workspaceId, blockerId);
    return true;
  }

  @Mutation(() => Boolean, {
    description:
      'Assign or re-assign a task. XOR — at most one of { userId, agentId } ' +
      'may be non-null. Both null clears assignees.',
  })
  async assignMnTask(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('assigneeUserId', { type: () => ID, nullable: true })
    assigneeUserId?: string | null,
    @Args('assigneeAgentId', { type: () => ID, nullable: true })
    assigneeAgentId?: string | null
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.assignTask(workspaceId, taskId, {
      userId: assigneeUserId ?? null,
      agentId: assigneeAgentId ?? null,
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // AI session ↔ task binding (M2.5 task-link chip backend)
  // ---------------------------------------------------------------------------

  @Mutation(() => Boolean, {
    description:
      'Bind the given chat session to a task so its messages get GOAL CONTEXT ' +
      'injected on the next turn. Pass null to unbind.',
  })
  async bindAiSessionToTask(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('sessionId', { type: () => ID }) sessionId: string,
    @Args('taskId', { type: () => ID, nullable: true })
    taskId?: string | null,
    @Args('depth', { type: () => Int, nullable: true })
    _depth?: number | null
  ): Promise<boolean> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    // Confirm the session belongs to the calling user + workspace, so we
    // can't be tricked into binding someone else's session.
    const session = await this.db.aiSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== user.id) {
      // Stay quiet about session existence; behave as if not found.
      return false;
    }
    if (session.workspaceId !== workspaceId) {
      return false;
    }
    if (taskId !== undefined && taskId !== null) {
      // Confirm the task belongs to the workspace too.
      const task = await this.db.mnTask.findUnique({ where: { id: taskId } });
      if (!task) return false;
      const project = await this.db.mnProject.findUnique({
        where: { id: task.projectId },
      });
      if (!project || project.workspaceId !== workspaceId) return false;
    }
    await this.db.aiSession.update({
      where: { id: sessionId },
      data: { taskId: taskId ?? null },
    });
    return true;
  }
}
