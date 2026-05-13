import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnNotificationChannel, MnReminderStatus } from '@prisma/client';

registerEnumType(MnReminderStatus, {
  name: 'MnReminderStatus',
  description: 'Superflow reminder lifecycle.',
});

registerEnumType(MnNotificationChannel, {
  name: 'MnNotificationChannel',
  description: 'Outbound notification channel for a reminder.',
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
