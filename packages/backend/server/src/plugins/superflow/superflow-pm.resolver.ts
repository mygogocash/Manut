import { randomUUID } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient, SfProjectStatus, SfTaskStatus } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { SfProjectObjectType } from './superflow.dto';
import {
  CreateSfProjectInput,
  CreateSfTaskInput,
  SfTaskObjectType,
  UpdateSfProjectInput,
  UpdateSfTaskInput,
} from './superflow-pm.dto';

@Resolver()
export class SuperflowPmResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController
  ) {}

  private async assertWorkspaceMember(
    workspaceId: string,
    userId?: string | null
  ) {
    if (!userId) {
      return;
    }

    const member = await this.db.workspaceUserRole.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) {
      throw new BadRequestException('User is not a workspace member');
    }
  }

  @Query(() => [SfProjectObjectType])
  async sfProjects(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SfProjectObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.sfProject.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Mutation(() => SfProjectObjectType)
  async createSfProject(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateSfProjectInput })
    input: CreateSfProjectInput
  ): Promise<SfProjectObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.sfProject.create({
      data: {
        id: randomUUID(),
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdByUserId: user.id,
      },
    });
  }

  @Mutation(() => SfProjectObjectType)
  async updateSfProject(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('input', { type: () => UpdateSfProjectInput })
    input: UpdateSfProjectInput
  ): Promise<SfProjectObjectType> {
    const project = await this.db.sfProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ac
      .user(user.id)
      .workspace(project.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.sfProject.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined && input.name !== null
          ? { name: input.name }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined && input.status !== null
          ? { status: input.status as SfProjectStatus }
          : {}),
        ...(input.sortOrder !== undefined && input.sortOrder !== null
          ? { sortOrder: input.sortOrder }
          : {}),
      },
    });
  }

  @Mutation(() => SfProjectObjectType)
  async archiveSfProject(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string
  ): Promise<SfProjectObjectType> {
    const project = await this.db.sfProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ac
      .user(user.id)
      .workspace(project.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.sfProject.update({
      where: { id: projectId },
      data: { status: SfProjectStatus.ARCHIVED },
    });
  }

  @Query(() => [SfTaskObjectType])
  async sfTasks(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string
  ): Promise<SfTaskObjectType[]> {
    const project = await this.db.sfProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ac
      .user(user.id)
      .workspace(project.workspaceId)
      .assert('Workspace.Read');

    return this.db.sfTask.findMany({
      where: { projectId },
      orderBy: [{ listSortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Mutation(() => SfTaskObjectType)
  async createSfTask(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('input', { type: () => CreateSfTaskInput }) input: CreateSfTaskInput
  ): Promise<SfTaskObjectType> {
    const project = await this.db.sfProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ac
      .user(user.id)
      .workspace(project.workspaceId)
      .assert('Workspace.Settings.Update');
    await this.assertWorkspaceMember(project.workspaceId, input.assigneeUserId);

    return this.db.sfTask.create({
      data: {
        id: randomUUID(),
        projectId,
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ?? null,
        listSortOrder: input.listSortOrder ?? 0,
        assigneeUserId: input.assigneeUserId ?? null,
        createdByUserId: user.id,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
      },
    });
  }

  @Mutation(() => SfTaskObjectType)
  async updateSfTask(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('input', { type: () => UpdateSfTaskInput }) input: UpdateSfTaskInput
  ): Promise<SfTaskObjectType> {
    const task = await this.db.sfTask.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.ac
      .user(user.id)
      .workspace(task.project.workspaceId)
      .assert('Workspace.Settings.Update');

    await this.assertWorkspaceMember(
      task.project.workspaceId,
      input.assigneeUserId
    );

    return this.db.sfTask.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined && input.title !== null
          ? { title: input.title }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        ...(input.listSortOrder !== undefined && input.listSortOrder !== null
          ? { listSortOrder: input.listSortOrder }
          : {}),
        ...(input.assigneeUserId !== undefined
          ? { assigneeUserId: input.assigneeUserId }
          : {}),
      },
    });
  }

  @Mutation(() => SfTaskObjectType)
  async updateSfTaskStatus(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('status', { type: () => SfTaskStatus }) status: SfTaskStatus
  ): Promise<SfTaskObjectType> {
    const task = await this.db.sfTask.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.ac
      .user(user.id)
      .workspace(task.project.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.sfTask.update({
      where: { id: taskId },
      data: { status },
    });
  }

  @Mutation(() => Boolean)
  async deleteSfTask(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string
  ): Promise<boolean> {
    const task = await this.db.sfTask.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.ac
      .user(user.id)
      .workspace(task.project.workspaceId)
      .assert('Workspace.Settings.Update');

    await this.db.sfTask.delete({ where: { id: taskId } });
    return true;
  }
}
