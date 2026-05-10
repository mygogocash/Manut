import { randomUUID } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  PrismaClient,
  SfNotificationChannel,
  SfReminderStatus,
} from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateSfReminderInput,
  SfReminderObjectType,
} from './superflow-reminder.dto';

@Resolver()
export class SuperflowReminderResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController
  ) {}

  @Query(() => [SfReminderObjectType], {
    description:
      'List reminders in a workspace: own reminders for all members; admins see all when they have Workspace.Settings.Update.',
  })
  async sfReminders(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SfReminderObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    let canSeeAll = false;
    try {
      await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .assert('Workspace.Settings.Update');
      canSeeAll = true;
    } catch {
      canSeeAll = false;
    }

    return this.db.sfReminder.findMany({
      where: {
        workspaceId,
        ...(canSeeAll ? {} : { userId: user.id }),
      },
      orderBy: { fireAt: 'asc' },
      take: 500,
    });
  }

  @Mutation(() => SfReminderObjectType)
  async createSfReminder(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateSfReminderInput })
    input: CreateSfReminderInput
  ): Promise<SfReminderObjectType> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.sfReminder.create({
      data: {
        id: randomUUID(),
        workspaceId,
        userId: user.id,
        title: input.title,
        body: input.body ?? null,
        fireAt: input.fireAt,
        channel: input.channel ?? SfNotificationChannel.EMAIL,
        status: SfReminderStatus.SCHEDULED,
      },
    });
  }

  @Mutation(() => SfReminderObjectType)
  async cancelSfReminder(
    @CurrentUser() user: CurrentUser,
    @Args('reminderId', { type: () => ID }) reminderId: string
  ): Promise<SfReminderObjectType> {
    const reminder = await this.db.sfReminder.findUnique({
      where: { id: reminderId },
    });
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (reminder.userId !== user.id) {
      await this.ac
        .user(user.id)
        .workspace(reminder.workspaceId)
        .assert('Workspace.Settings.Update');
    } else {
      await this.ac
        .user(user.id)
        .workspace(reminder.workspaceId)
        .assert('Workspace.Read');
    }

    return this.db.sfReminder.update({
      where: { id: reminderId },
      data: { status: SfReminderStatus.CANCELLED },
    });
  }
}
