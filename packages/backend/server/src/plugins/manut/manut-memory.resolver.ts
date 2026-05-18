import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  MnAgentMemoryObjectType,
  StoreMnAgentMemoryInput,
} from './manut-memory.dto';
import { MnAgentMemoryService } from './manut-memory.service';

/**
 * GraphQL surface for Manut Agent Memory (M9).
 *
 * Every nullable @Field on the DTOs uses the explicit `() => Type` form
 * per CLAUDE.md §6 (UndefinedTypeError trap). Permissions are checked
 * via `AccessController` BEFORE the service call so the service can stay
 * focused on data invariants.
 */
@Resolver(() => MnAgentMemoryObjectType)
export class MnAgentMemoryResolver {
  constructor(
    private readonly service: MnAgentMemoryService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnAgentMemoryObjectType], {
    description:
      'List memories for an agent. Pass taskId to narrow to memories ' +
      'pinned to a specific task; otherwise returns all agent memories ' +
      'ranked by importance then recency.',
  })
  async mnAgentMemories(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('taskId', { type: () => ID, nullable: true })
    taskId?: string | null
  ): Promise<MnAgentMemoryObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.list(workspaceId, agentId, {
      taskId: taskId ?? null,
    }) as Promise<MnAgentMemoryObjectType[]>;
  }

  @Query(() => [MnAgentMemoryObjectType], {
    description:
      'Recall top memories for an agent ranked by importance and recency. ' +
      'Touches retrievedCount + lastRetrievedAt as a side effect so the ' +
      'next recall sees the recency boost. Limit is clamped to [1, 100].',
  })
  async recallMnAgentMemories(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('taskId', { type: () => ID, nullable: true })
    taskId?: string | null,
    @Args('limit', { type: () => Int, nullable: true })
    limit?: number | null
  ): Promise<MnAgentMemoryObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.recall(workspaceId, agentId, {
      taskId: taskId ?? null,
      limit: limit ?? 10,
    }) as Promise<MnAgentMemoryObjectType[]>;
  }

  @Mutation(() => MnAgentMemoryObjectType, {
    description: 'Store a new memory row. Requires Workspace.Settings.Update.',
  })
  async storeMnAgentMemory(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => StoreMnAgentMemoryInput })
    input: StoreMnAgentMemoryInput
  ): Promise<MnAgentMemoryObjectType> {
    await this.ac
      .user(user.id)
      .workspace(input.workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.storeMemory(input) as Promise<MnAgentMemoryObjectType>;
  }

  @Mutation(() => Boolean, {
    description:
      'Delete a memory row. Requires Workspace.Settings.Update. Returns ' +
      'true on success; throws NotFound when the row is missing or belongs ' +
      'to another workspace.',
  })
  async deleteMnAgentMemory(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('memoryId', { type: () => ID }) memoryId: string
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.delete(workspaceId, memoryId);
    return true;
  }
}
