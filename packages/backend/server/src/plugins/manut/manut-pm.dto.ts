import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnProjectStatus, MnTaskPriority, MnTaskStatus } from '@prisma/client';

registerEnumType(MnTaskStatus, {
  name: 'MnTaskStatus',
  description: 'Manut task workflow state.',
});

registerEnumType(MnTaskPriority, {
  name: 'MnTaskPriority',
  description: 'Manut task priority.',
});

@InputType()
export class CreateMnProjectInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Int, { nullable: true })
  sortOrder?: number | null;
}

@InputType()
export class UpdateMnProjectInput {
  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => MnProjectStatus, { nullable: true })
  status?: MnProjectStatus | null;

  @Field(() => Int, { nullable: true })
  sortOrder?: number | null;
}

@InputType()
export class CreateMnTaskInput {
  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => MnTaskStatus, { nullable: true })
  status?: MnTaskStatus;

  @Field(() => MnTaskPriority, { nullable: true })
  priority?: MnTaskPriority;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt?: Date | null;

  @Field(() => Int, { nullable: true })
  listSortOrder?: number | null;

  @Field(() => ID, { nullable: true })
  assigneeUserId?: string | null;
}

@InputType()
export class UpdateMnTaskInput {
  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => MnTaskStatus, { nullable: true })
  status?: MnTaskStatus;

  @Field(() => MnTaskPriority, { nullable: true })
  priority?: MnTaskPriority;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt?: Date | null;

  @Field(() => Int, { nullable: true })
  listSortOrder?: number | null;

  @Field(() => ID, { nullable: true })
  assigneeUserId?: string | null;
}

@ObjectType('MnTask')
export class MnTaskObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => MnTaskStatus)
  status!: MnTaskStatus;

  @Field(() => MnTaskPriority)
  priority!: MnTaskPriority;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt!: Date | null;

  @Field(() => Int)
  listSortOrder!: number;

  @Field(() => ID, { nullable: true })
  assigneeUserId!: string | null;

  @Field(() => ID, { nullable: true })
  createdByUserId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
