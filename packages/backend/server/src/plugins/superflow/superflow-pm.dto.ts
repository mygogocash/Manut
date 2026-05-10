import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { SfProjectStatus, SfTaskPriority, SfTaskStatus } from '@prisma/client';

registerEnumType(SfTaskStatus, {
  name: 'SfTaskStatus',
  description: 'Superflow task workflow state.',
});

registerEnumType(SfTaskPriority, {
  name: 'SfTaskPriority',
  description: 'Superflow task priority.',
});

@InputType()
export class CreateSfProjectInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Int, { nullable: true })
  sortOrder?: number | null;
}

@InputType()
export class UpdateSfProjectInput {
  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => SfProjectStatus, { nullable: true })
  status?: SfProjectStatus | null;

  @Field(() => Int, { nullable: true })
  sortOrder?: number | null;
}

@InputType()
export class CreateSfTaskInput {
  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => SfTaskStatus, { nullable: true })
  status?: SfTaskStatus;

  @Field(() => SfTaskPriority, { nullable: true })
  priority?: SfTaskPriority;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt?: Date | null;

  @Field(() => Int, { nullable: true })
  listSortOrder?: number | null;

  @Field(() => ID, { nullable: true })
  assigneeUserId?: string | null;
}

@InputType()
export class UpdateSfTaskInput {
  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => SfTaskStatus, { nullable: true })
  status?: SfTaskStatus;

  @Field(() => SfTaskPriority, { nullable: true })
  priority?: SfTaskPriority;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt?: Date | null;

  @Field(() => Int, { nullable: true })
  listSortOrder?: number | null;

  @Field(() => ID, { nullable: true })
  assigneeUserId?: string | null;
}

@ObjectType('SfTask')
export class SfTaskObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => SfTaskStatus)
  status!: SfTaskStatus;

  @Field(() => SfTaskPriority)
  priority!: SfTaskPriority;

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
