import { randomUUID } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MnProjectStatus, MnTaskStatus, PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { MnProjectObjectType } from './superflow.dto';
import {
  CreateMnProjectInput,
  CreateMnTaskInput,
  MnTaskObjectType,
  UpdateMnProjectInput,
  UpdateMnTaskInput,
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

  @Query(() => [MnProjectObjectType])
  async mnProjects(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnProjectObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.mnProject.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Mutation(() => MnProjectObjectType)
  async createMnProject(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnProjectInput })
    input: CreateMnProjectInput
  ): Promise<MnProjectObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.mnProject.create({
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

  @Mutation(() => MnProjectObjectType)
  async updateMnProject(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('input', { type: () => UpdateMnProjectInput })
    input: UpdateMnProjectInput
  ): Promise<MnProjectObjectType> {
    const project = await this.db.mnProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ac
      .user(user.id)
      .workspace(project.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.mnProject.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined && input.name !== null
          ? { name: input.name }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined && input.status !== null
          ? { status: input.status as MnProjectStatus }
          : {}),
        ...(input.sortOrder !== undefined && input.sortOrder !== null
          ? { sortOrder: input.sortOrder }
          : {}),
      },
    });
  }

  @Mutation(() => MnProjectObjectType)
  async archiveMnProject(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string
  ): Promise<MnProjectObjectType> {
    const project = await this.db.mnProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ac
      .user(user.id)
      .workspace(project.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.mnProject.update({
      where: { id: projectId },
      data: { status: MnProjectStatus.ARCHIVED },
    });
  }

  @Query(() => [MnTaskObjectType])
  async mnTasks(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string
  ): Promise<MnTaskObjectType[]> {
    const project = await this.db.mnProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ac
      .user(user.id)
      .workspace(project.workspaceId)
      .assert('Workspace.Read');

    return this.db.mnTask.findMany({
      where: { projectId },
      orderBy: [{ listSortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Mutation(() => MnTaskObjectType)
  async createMnTask(
    @CurrentUser() user: CurrentUser,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('input', { type: () => CreateMnTaskInput }) input: CreateMnTaskInput
  ): Promise<MnTaskObjectType> {
    const project = await this.db.mnProject.findUnique({
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

    return this.db.mnTask.create({
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

  @Mutation(() => MnTaskObjectType)
  async updateMnTask(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('input', { type: () => UpdateMnTaskInput }) input: UpdateMnTaskInput
  ): Promise<MnTaskObjectType> {
    const task = await this.db.mnTask.findUnique({
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

    return this.db.mnTask.update({
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

  @Mutation(() => MnTaskObjectType)
  async updateMnTaskStatus(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('status', { type: () => MnTaskStatus }) status: MnTaskStatus
  ): Promise<MnTaskObjectType> {
    const task = await this.db.mnTask.findUnique({
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

    return this.db.mnTask.update({
      where: { id: taskId },
      data: { status },
    });
  }

  @Mutation(() => Boolean)
  async deleteMnTask(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string
  ): Promise<boolean> {
    const task = await this.db.mnTask.findUnique({
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

    await this.db.mnTask.delete({ where: { id: taskId } });
    return true;
  }
}
