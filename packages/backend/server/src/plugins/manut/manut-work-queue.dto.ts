import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnIntakeStatus, MnTaskPriority } from '@prisma/client';

/**
 * M14 — Work Queue GraphQL surface.
 *
 * Every `@Field` declaration here passes an EXPLICIT type tag (e.g.
 * `() => String`, `() => MnTaskPriority`) per the v1.7.0 / v1.10.2
 * UndefinedTypeError scar — NestJS reflection cannot infer the GraphQL
 * type from a nullable TypeScript union, and a missing tag crashes the
 * server at startup before listening.
 *
 * `routingRules` is rendered as a JSON-stringified `String` in the
 * schema rather than a typed object graph — the rule shape is free-form
 * enough (different ops, optional assigneeRoleSlug vs assigneeAgentId)
 * that flattening it to GraphQL types would either explode the schema
 * or force a discriminated union we don't currently need. The frontend
 * parses the JSON on read and serialises on write.
 */

registerEnumType(MnIntakeStatus, {
  name: 'MnIntakeStatus',
  description: 'Manut work queue intake lifecycle status.',
});

@InputType()
export class CreateMnWorkQueueInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  /**
   * JSON-stringified routing rules. Validated server-side as
   * Array<{ match: { field, op, value }, assignToAgentId?, assignToRoleSlug? }>.
   */
  @Field(() => String, { nullable: true })
  routingRulesJson?: string | null;

  @Field(() => ID, { nullable: true })
  defaultAssigneeAgentId?: string | null;

  @Field(() => MnTaskPriority, { nullable: true })
  defaultPriority?: MnTaskPriority | null;
}

@InputType()
export class UpdateMnWorkQueueInput {
  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  routingRulesJson?: string | null;

  @Field(() => ID, { nullable: true })
  defaultAssigneeAgentId?: string | null;

  @Field(() => MnTaskPriority, { nullable: true })
  defaultPriority?: MnTaskPriority | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean | null;
}

@ObjectType('MnWorkQueue')
export class MnWorkQueueObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String)
  intakeWebhookToken!: string;

  /** JSON-stringified routing rules array. */
  @Field(() => String)
  routingRulesJson!: string;

  @Field(() => ID, { nullable: true })
  defaultAssigneeAgentId!: string | null;

  @Field(() => MnTaskPriority)
  defaultPriority!: MnTaskPriority;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('MnWorkQueueIntake')
export class MnWorkQueueIntakeObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  queueId!: string;

  @Field(() => String, { nullable: true })
  externalRef!: string | null;

  /** JSON-stringified payload. */
  @Field(() => String)
  payloadJson!: string;

  @Field(() => MnIntakeStatus)
  status!: MnIntakeStatus;

  @Field(() => ID, { nullable: true })
  routedToTaskId!: string | null;

  @Field(() => GraphQLISODateTime)
  receivedAt!: Date;
}
