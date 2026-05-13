import { randomUUID } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  MnNotificationChannel,
  MnReminderStatus,
  PrismaClient,
} from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnReminderInput,
  MnReminderObjectType,
} from './manut-reminder.dto';

@Resolver()
export class SuperflowReminderResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnReminderObjectType], {
    description:
      'List reminders in a workspace: own reminders for all members; admins see all when they have Workspace.Settings.Update.',
  })
  async mnReminders(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnReminderObjectType[]> {
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

    return this.db.mnReminder.findMany({
      where: {
        workspaceId,
        ...(canSeeAll ? {} : { userId: user.id }),
      },
      orderBy: { fireAt: 'asc' },
      take: 500,
    });
  }

  @Mutation(() => MnReminderObjectType)
  async createMnReminder(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnReminderInput })
    input: CreateMnReminderInput
  ): Promise<MnReminderObjectType> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.mnReminder.create({
      data: {
        id: randomUUID(),
        workspaceId,
        userId: user.id,
        title: input.title,
        body: input.body ?? null,
        fireAt: input.fireAt,
        channel: input.channel ?? MnNotificationChannel.EMAIL,
        status: MnReminderStatus.SCHEDULED,
      },
    });
  }

  @Mutation(() => MnReminderObjectType)
  async cancelMnReminder(
    @CurrentUser() user: CurrentUser,
    @Args('reminderId', { type: () => ID }) reminderId: string
  ): Promise<MnReminderObjectType> {
    const reminder = await this.db.mnReminder.findUnique({
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

    return this.db.mnReminder.update({
      where: { id: reminderId },
      data: { status: MnReminderStatus.CANCELLED },
    });
  }
}
