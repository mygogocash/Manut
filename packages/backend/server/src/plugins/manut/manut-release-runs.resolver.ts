import { NotFoundException } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  MnReleaseRunObjectType,
  MnReleaseTaskObjectType,
} from './manut-release-runs.dto';
import { MnReleaseRunsService } from './manut-release-runs.service';

@Resolver(() => MnReleaseRunObjectType)
export class MnReleaseRunsResolver {
  constructor(
    private readonly runs: MnReleaseRunsService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnReleaseRunObjectType], {
    description:
      'List Manut release runs for the given workspace, newest first.',
  })
  async releaseRuns(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('limit', { type: () => Int, nullable: true })
    limit?: number | null,
    @Args('offset', { type: () => Int, nullable: true })
    offset?: number | null
  ): Promise<MnReleaseRunObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return (await this.runs.listRuns(workspaceId, {
      limit,
      offset,
    })) as MnReleaseRunObjectType[];
  }

  @Query(() => MnReleaseRunObjectType, {
    description: 'Fetch a single Manut release run scoped to the workspace.',
  })
  async releaseRun(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('runId', { type: () => ID }) runId: string
  ): Promise<MnReleaseRunObjectType> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const run = await this.runs.getRun(workspaceId, runId);
    if (!run) {
      throw new NotFoundException('Release run not found');
    }
    return run as unknown as MnReleaseRunObjectType;
  }

  @ResolveField(() => [MnReleaseTaskObjectType])
  async tasks(
    @Parent() parent: MnReleaseRunObjectType
  ): Promise<MnReleaseTaskObjectType[]> {
    // If the parent was loaded via getRun(), tasks are already included.
    // Otherwise the listRuns query path returns rows without tasks and
    // we lazy-load them here.
    const includedTasks = (
      parent as MnReleaseRunObjectType & {
        tasks?: MnReleaseTaskObjectType[];
      }
    ).tasks;
    if (Array.isArray(includedTasks)) {
      return includedTasks;
    }
    return (await this.runs.listTasks(parent.id)) as MnReleaseTaskObjectType[];
  }
}
