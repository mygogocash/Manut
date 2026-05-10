import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AuthenticationRequired } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AgentsService } from './service';
import {
  AgentLinkType,
  AgentType,
  CreateAgentInput,
  UpdateAgentInput,
} from './types';

function toGraphQL(
  agent:
    | NonNullable<Awaited<ReturnType<AgentsService['get']>>>
    | Awaited<ReturnType<AgentsService['list']>>[number]
): AgentType {
  const links: AgentLinkType[] = (agent.links ?? []).map((l: any) => {
    const out: AgentLinkType = { url: l.url };
    if (l.label !== undefined) out.label = l.label;
    return out;
  });
  return { ...agent, links };
}

@Resolver(() => AgentType)
export class AgentsResolver {
  constructor(private readonly service: AgentsService) {}

  @Query(() => [AgentType])
  async agents(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('parentAgentId', { nullable: true }) parentAgentId?: string
  ): Promise<AgentType[]> {
    if (!user) throw new AuthenticationRequired();
    const rows = await this.service.list(user.id, workspaceId, parentAgentId);
    return rows.map(toGraphQL);
  }

  @Query(() => AgentType, { nullable: true })
  async agent(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string
  ): Promise<AgentType | null> {
    if (!user) throw new AuthenticationRequired();
    const row = await this.service.get(user.id, id);
    return row ? toGraphQL(row) : null;
  }

  @Mutation(() => AgentType)
  async createAgent(
    @CurrentUser() user: CurrentUser | null,
    @Args('input') input: CreateAgentInput
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.create(user.id, input));
  }

  @Mutation(() => AgentType)
  async updateAgent(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string,
    @Args('input') input: UpdateAgentInput
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.update(user.id, id, input));
  }

  @Mutation(() => Boolean)
  async deleteAgent(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string
  ): Promise<boolean> {
    if (!user) throw new AuthenticationRequired();
    return this.service.delete(user.id, id);
  }

  @Mutation(() => AgentType)
  async addAgentSkill(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string,
    @Args('skill') skill: string
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.addSkill(user.id, id, skill));
  }

  @Mutation(() => AgentType)
  async removeAgentSkill(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string,
    @Args('skill') skill: string
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.removeSkill(user.id, id, skill));
  }

  @Mutation(() => AgentType)
  async addAgentLink(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string,
    @Args('url') url: string,
    @Args('label', { nullable: true }) label?: string
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.addLink(user.id, id, url, label));
  }

  @Mutation(() => AgentType)
  async removeAgentLink(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string,
    @Args('url') url: string
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.removeLink(user.id, id, url));
  }

  @Mutation(() => AgentType)
  async addAgentFile(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string,
    @Args('fileId') fileId: string
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.addFile(user.id, id, fileId));
  }

  @Mutation(() => AgentType)
  async removeAgentFile(
    @CurrentUser() user: CurrentUser | null,
    @Args('id') id: string,
    @Args('fileId') fileId: string
  ): Promise<AgentType> {
    if (!user) throw new AuthenticationRequired();
    return toGraphQL(await this.service.removeFile(user.id, id, fileId));
  }
}
