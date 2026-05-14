import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  MnAgentRoleObjectType,
  UpdateMnAgentRoleInput,
} from './manut-agent-registry.dto';
import { MnAgentRegistryService } from './manut-agent-registry.service';

@Resolver(() => MnAgentRoleObjectType)
export class MnAgentRegistryResolver {
  constructor(
    private readonly service: MnAgentRegistryService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnAgentRoleObjectType], {
    description:
      'Return the 5 canonical operating roles registered for a workspace.',
  })
  async agentRoles(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string
  ): Promise<MnAgentRoleObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.service.listRoles(workspaceId) as Promise<
      MnAgentRoleObjectType[]
    >;
  }

  @Mutation(() => MnAgentRoleObjectType, {
    description:
      'Update an agent role. The slug is immutable; only displayName, ' +
      'adapter, responsibility, and escalation can be edited.',
  })
  async updateAgentRole(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('slug', { type: () => String }) slug: string,
    @Args('input', { type: () => UpdateMnAgentRoleInput })
    input: UpdateMnAgentRoleInput
  ): Promise<MnAgentRoleObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    return this.service.updateRole(
      workspaceId,
      slug,
      input
    ) as Promise<MnAgentRoleObjectType>;
  }
}
