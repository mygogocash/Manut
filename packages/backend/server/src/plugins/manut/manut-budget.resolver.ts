import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MnBudgetScope } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnBudgetInput,
  type CreateMnBudgetValues,
  MnBudgetObjectType,
  MnBudgetRollupObjectType,
  MnCostEventObjectType,
  UpdateMnBudgetInput,
  type UpdateMnBudgetValues,
} from './manut-budget.dto';
import { MnBudgetService } from './manut-budget.service';
import { MnBudgetEnforcerService } from './manut-budget-enforcer.service';

/**
 * GraphQL surface for Manut budgets + cost events (M4).
 *
 * Every nullable @Field on the DTOs already uses the explicit `() => Type`
 * form (CLAUDE.md §6). Permissions are checked via `AccessController`
 * BEFORE the service call.
 */
@Resolver(() => MnBudgetObjectType)
export class MnBudgetResolver {
  constructor(
    private readonly service: MnBudgetService,
    private readonly enforcer: MnBudgetEnforcerService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnBudgetObjectType], {
    description:
      'List budgets in a workspace, optionally narrowed by month or scope.',
  })
  async mnBudgets(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('monthYear', { type: () => String, nullable: true })
    monthYear?: string | null,
    @Args('scopeType', { type: () => MnBudgetScope, nullable: true })
    scopeType?: MnBudgetScope | null
  ): Promise<MnBudgetObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.list(workspaceId, {
      monthYear: monthYear ?? undefined,
      scopeType: scopeType ?? undefined,
    }) as Promise<MnBudgetObjectType[]>;
  }

  @Query(() => MnBudgetObjectType, {
    nullable: true,
    description: 'Fetch a single budget by id.',
  })
  async mnBudget(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('budgetId', { type: () => ID }) budgetId: string
  ): Promise<MnBudgetObjectType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.get(
      workspaceId,
      budgetId
    ) as Promise<MnBudgetObjectType | null>;
  }

  @Query(() => [MnCostEventObjectType], {
    description:
      'Recent cost events for a workspace; capped at 500 by default.',
  })
  async mnCostEvents(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('projectId', { type: () => ID, nullable: true })
    projectId?: string | null,
    @Args('agentId', { type: () => ID, nullable: true })
    agentId?: string | null,
    @Args('taskId', { type: () => ID, nullable: true })
    taskId?: string | null,
    @Args('monthYear', { type: () => String, nullable: true })
    monthYear?: string | null,
    @Args('limit', { type: () => Int, nullable: true })
    limit?: number | null
  ): Promise<MnCostEventObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.listCostEvents(workspaceId, {
      projectId: projectId ?? undefined,
      agentId: agentId ?? undefined,
      taskId: taskId ?? undefined,
      monthYear: monthYear ?? undefined,
      limit: limit ?? undefined,
    }) as Promise<MnCostEventObjectType[]>;
  }

  @Query(() => [MnBudgetRollupObjectType], {
    description:
      'Per-project spend rollup for the dashboard. Joins budgets with ' +
      'live cost-event aggregates for projects without a configured cap.',
  })
  async mnBudgetProjectRollups(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('monthYear', { type: () => String }) monthYear: string
  ): Promise<MnBudgetRollupObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.projectRollups(workspaceId, monthYear) as Promise<
      MnBudgetRollupObjectType[]
    >;
  }

  @Mutation(() => MnBudgetObjectType, {
    description: 'Create a new budget. Requires Workspace.Settings.Update.',
  })
  async createMnBudget(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => CreateMnBudgetInput })
    input: CreateMnBudgetInput
  ): Promise<MnBudgetObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    // Zod tolerates the `null` GraphQL inputs allow; cast here so the
    // service's typed schema doesn't have to mirror the GraphQL nullability.
    const created = await this.service.create(
      workspaceId,
      input as unknown as CreateMnBudgetValues
    );
    this.enforcer.invalidateAll();
    return created as MnBudgetObjectType;
  }

  @Mutation(() => MnBudgetObjectType, {
    description:
      'Update editable fields on a budget. Resets alertSent if cap is raised.',
  })
  async updateMnBudget(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('budgetId', { type: () => ID }) budgetId: string,
    @Args('input', { type: () => UpdateMnBudgetInput })
    input: UpdateMnBudgetInput
  ): Promise<MnBudgetObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const updated = await this.service.update(
      workspaceId,
      budgetId,
      input as unknown as UpdateMnBudgetValues
    );
    this.enforcer.invalidateAll();
    return updated as MnBudgetObjectType;
  }

  @Mutation(() => Boolean, {
    description: 'Delete a budget. Cost events are preserved.',
  })
  async deleteMnBudget(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('budgetId', { type: () => ID }) budgetId: string
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.delete(workspaceId, budgetId);
    this.enforcer.invalidateAll();
    return true;
  }
}
