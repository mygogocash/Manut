import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { SfNotificationChannel, SfReminderStatus } from '@prisma/client';

registerEnumType(SfReminderStatus, {
  name: 'SfReminderStatus',
  description: 'Superflow reminder lifecycle.',
});

registerEnumType(SfNotificationChannel, {
  name: 'SfNotificationChannel',
  description: 'Outbound notification channel for a reminder.',
});

@ObjectType('SfReminder')
export class SfReminderObjectType {
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

  @Field(() => SfNotificationChannel)
  channel!: SfNotificationChannel;

  @Field(() => SfReminderStatus)
  status!: SfReminderStatus;

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
export class CreateSfReminderInput {
  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  body?: string | null;

  @Field(() => GraphQLISODateTime)
  fireAt!: Date;

  @Field(() => SfNotificationChannel, { nullable: true })
  channel?: SfNotificationChannel;
}
