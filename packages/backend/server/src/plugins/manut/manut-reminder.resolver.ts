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
  CreateMnReminderRuleInput,
  MnReminderObjectType,
  MnReminderRuleObjectType,
  UpdateMnReminderRuleInput,
} from './manut-reminder.dto';

@Resolver()
export class MnReminderResolver {
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

  // ─── Reminder rules (Rules tab) ─────────────────────────────────────────
  //
  // The Prisma model `MnReminderRule` and the cron evaluator have shipped
  // since v1.12.0, but the GraphQL resolvers were never wired — the
  // frontend's `mnReminderRulesQuery` hit a non-existent field and
  // surfaced as INTERNAL_SERVER_ERROR on the Rules tab. This block closes
  // that gap with the same permission pattern as `mnReminders` above:
  // Workspace.Read for listing, Workspace.Settings.Update for mutating.

  @Query(() => [MnReminderRuleObjectType], {
    description:
      'List reminder rules in a workspace. Requires Workspace.Read.',
  })
  async mnReminderRules(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnReminderRuleObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const rows = await this.db.mnReminderRule.findMany({
      where: { workspaceId },
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
      take: 500,
    });

    return rows.map(toRuleDto);
  }

  @Mutation(() => MnReminderRuleObjectType, {
    description:
      'Create a reminder rule. Requires Workspace.Settings.Update.',
  })
  async createMnReminderRule(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnReminderRuleInput })
    input: CreateMnReminderRuleInput
  ): Promise<MnReminderRuleObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const row = await this.db.mnReminderRule.create({
      data: {
        id: randomUUID(),
        workspaceId,
        name: input.name,
        enabled: input.enabled ?? true,
        trigger: input.trigger,
        cronExpression: input.cronExpression ?? null,
        timezone: input.timezone ?? null,
        config: (input.config ?? {}) as object,
        createdByUserId: user.id,
      },
    });

    return toRuleDto(row);
  }

  @Mutation(() => MnReminderRuleObjectType, {
    description:
      'Update a reminder rule. The trigger field is immutable after create. Requires Workspace.Settings.Update on the rule\'s workspace.',
  })
  async updateMnReminderRule(
    @CurrentUser() user: CurrentUser,
    @Args('ruleId', { type: () => ID }) ruleId: string,
    @Args('input', { type: () => UpdateMnReminderRuleInput })
    input: UpdateMnReminderRuleInput
  ): Promise<MnReminderRuleObjectType> {
    const existing = await this.db.mnReminderRule.findUnique({
      where: { id: ruleId },
    });
    if (!existing) {
      throw new NotFoundException('Reminder rule not found');
    }

    await this.ac
      .user(user.id)
      .workspace(existing.workspaceId)
      .assert('Workspace.Settings.Update');

    // Partial update — only fields the caller provided.
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.cronExpression !== undefined)
      data.cronExpression = input.cronExpression;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.config !== undefined) data.config = input.config ?? {};

    const row = await this.db.mnReminderRule.update({
      where: { id: ruleId },
      data,
    });

    return toRuleDto(row);
  }

  @Mutation(() => Boolean, {
    description:
      'Delete a reminder rule. Pending reminders generated by the rule are kept (the FK is nullable on MnReminder.ruleId). Requires Workspace.Settings.Update.',
  })
  async deleteMnReminderRule(
    @CurrentUser() user: CurrentUser,
    @Args('ruleId', { type: () => ID }) ruleId: string
  ): Promise<boolean> {
    const existing = await this.db.mnReminderRule.findUnique({
      where: { id: ruleId },
    });
    if (!existing) {
      throw new NotFoundException('Reminder rule not found');
    }

    await this.ac
      .user(user.id)
      .workspace(existing.workspaceId)
      .assert('Workspace.Settings.Update');

    await this.db.mnReminderRule.delete({ where: { id: ruleId } });
    return true;
  }
}

/**
 * Prisma row → GraphQL DTO. The DB schema has no `nextRunAt` column
 * (the cron evaluator re-derives it every minute), so we return null
 * here. Frontend renders null as a dash. Wire a real parser in a
 * follow-up if operators ask for the projection.
 */
function toRuleDto(
  row: Awaited<ReturnType<PrismaClient['mnReminderRule']['findUnique']>> &
    object
): MnReminderRuleObjectType {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    enabled: row.enabled,
    trigger: row.trigger,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    config: (row.config ?? {}) as Record<string, unknown>,
    lastEvaluatedAt: row.lastEvaluatedAt,
    nextRunAt: null,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
