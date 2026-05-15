import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  MnNotificationChannel,
  MnReminderRuleTrigger,
  MnReminderStatus,
} from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';

registerEnumType(MnReminderStatus, {
  name: 'MnReminderStatus',
  description: 'Superflow reminder lifecycle.',
});

registerEnumType(MnNotificationChannel, {
  name: 'MnNotificationChannel',
  description: 'Outbound notification channel for a reminder.',
});

registerEnumType(MnReminderRuleTrigger, {
  name: 'MnReminderRuleTrigger',
  description: 'When a reminder rule fires: cron-driven (DATETIME) or event-driven (OVERDUE_TASK, INACTIVITY, UPCOMING_DEADLINE). v0 surfaces only DATETIME in the UI.',
});

@ObjectType('MnReminder')
export class MnReminderObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  body!: string | null;

  @Field(() => GraphQLISODateTime)
  fireAt!: Date;

  @Field(() => MnNotificationChannel)
  channel!: MnNotificationChannel;

  @Field(() => MnReminderStatus)
  status!: MnReminderStatus;

  @Field(() => String, { nullable: true })
  relatedEntityType!: string | null;

  @Field(() => String, { nullable: true })
  relatedEntityId!: string | null;

  @Field(() => ID, { nullable: true })
  ruleId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  completedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType()
export class CreateMnReminderInput {
  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  body?: string | null;

  @Field(() => GraphQLISODateTime)
  fireAt!: Date;

  @Field(() => MnNotificationChannel, { nullable: true })
  channel?: MnNotificationChannel;
}

@ObjectType('MnReminderRule')
export class MnReminderRuleObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => MnReminderRuleTrigger)
  trigger!: MnReminderRuleTrigger;

  @Field(() => String, { nullable: true })
  cronExpression!: string | null;

  @Field(() => String, { nullable: true })
  timezone!: string | null;

  @Field(() => GraphQLJSONObject)
  config!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastEvaluatedAt!: Date | null;

  /**
   * Best-effort projection of when this rule's cron expression next
   * fires. Returns null in v0 — no cron parser is in deps yet and the
   * cron job runs every minute scanning rules directly. Frontend
   * renders null as a dash. Wire a real parser in a follow-up if
   * operators ask for "next run" projection.
   */
  @Field(() => GraphQLISODateTime, { nullable: true })
  nextRunAt!: Date | null;

  @Field(() => ID)
  createdByUserId!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType()
export class CreateMnReminderRuleInput {
  @Field(() => String)
  name!: string;

  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  @Field(() => MnReminderRuleTrigger)
  trigger!: MnReminderRuleTrigger;

  @Field(() => String, { nullable: true })
  cronExpression?: string | null;

  @Field(() => String, { nullable: true })
  timezone?: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  config?: Record<string, unknown> | null;
}

@InputType()
export class UpdateMnReminderRuleInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  @Field(() => String, { nullable: true })
  cronExpression?: string | null;

  @Field(() => String, { nullable: true })
  timezone?: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  config?: Record<string, unknown> | null;
}
