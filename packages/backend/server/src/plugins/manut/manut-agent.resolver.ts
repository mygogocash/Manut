import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnAgentInput,
  MnAgentObjectType,
  UpdateMnAgentInput,
} from './manut-agent.dto';
import { MnAgentService } from './manut-agent.service';

/**
 * GraphQL surface for Manut agents (M1).
 *
 * Every nullable @Field on the DTOs uses the explicit `() => Type`
 * form per CLAUDE.md §6 (UndefinedTypeError trap). Permissions are
 * checked via `AccessController` BEFORE the service call so the
 * service can stay focused on data invariants.
 */
@Resolver(() => MnAgentObjectType)
export class MnAgentResolver {
  constructor(
    private readonly service: MnAgentService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnAgentObjectType], {
    description: 'List agents in a workspace, optionally filtered by project.',
  })
  async mnAgents(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('projectId', { type: () => ID, nullable: true })
    projectId?: string | null
  ): Promise<MnAgentObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.list(workspaceId, projectId ?? null) as Promise<
      MnAgentObjectType[]
    >;
  }

  @Query(() => MnAgentObjectType, {
    nullable: true,
    description:
      'Fetch a single agent by id. Returns null when the agent does ' +
      'not exist or belongs to another workspace.',
  })
  async mnAgent(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string
  ): Promise<MnAgentObjectType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.get(
      workspaceId,
      agentId
    ) as Promise<MnAgentObjectType | null>;
  }

  @Mutation(() => MnAgentObjectType, {
    description: 'Create a new agent. Requires Workspace.Settings.Update.',
  })
  async createMnAgent(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => CreateMnAgentInput })
    input: CreateMnAgentInput
  ): Promise<MnAgentObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.create(
      workspaceId,
      user.id,
      input
    ) as Promise<MnAgentObjectType>;
  }

  @Mutation(() => MnAgentObjectType, {
    description:
      'Patch editable fields on an agent. TERMINATED agents cannot be ' +
      'resumed; updating them is rejected.',
  })
  async updateMnAgent(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('input', { type: () => UpdateMnAgentInput })
    input: UpdateMnAgentInput
  ): Promise<MnAgentObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.update(
      workspaceId,
      agentId,
      input
    ) as Promise<MnAgentObjectType>;
  }

  @Mutation(() => Boolean, {
    description: 'Delete an agent. Cascades to API keys and heartbeat runs.',
  })
  async deleteMnAgent(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.delete(workspaceId, agentId);
    return true;
  }
}
