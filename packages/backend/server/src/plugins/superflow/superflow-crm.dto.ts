import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { SfCrmActivityType } from '@prisma/client';

registerEnumType(SfCrmActivityType, {
  name: 'SfCrmActivityType',
  description: 'CRM activity category.',
});

@ObjectType('SfCrmAccount')
export class SfCrmAccountObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  website!: string | null;

  @Field(() => String, { nullable: true })
  industry!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => ID, { nullable: true })
  ownerUserId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('SfCrmContact')
export class SfCrmContactObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID, { nullable: true })
  accountId!: string | null;

  @Field(() => String)
  firstName!: string;

  @Field(() => String, { nullable: true })
  lastName!: string | null;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => ID, { nullable: true })
  ownerUserId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('SfCrmDealStage')
export class SfCrmDealStageObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String)
  pipelineKey!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType('SfCrmDeal')
export class SfCrmDealObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID, { nullable: true })
  accountId!: string | null;

  @Field(() => ID, { nullable: true })
  contactId!: string | null;

  @Field(() => ID)
  stageId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Float, { nullable: true })
  value!: number | null;

  @Field(() => String, { nullable: true })
  currency!: string | null;

  @Field(() => Int, { nullable: true })
  probability!: number | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expectedCloseAt!: Date | null;

  @Field(() => ID, { nullable: true })
  ownerUserId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('SfCrmActivity')
export class SfCrmActivityObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID, { nullable: true })
  accountId!: string | null;

  @Field(() => ID, { nullable: true })
  contactId!: string | null;

  @Field(() => ID, { nullable: true })
  dealId!: string | null;

  @Field(() => SfCrmActivityType)
  type!: SfCrmActivityType;

  @Field(() => String, { nullable: true })
  subject!: string | null;

  @Field(() => String, { nullable: true })
  body!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  completedAt!: Date | null;

  @Field(() => ID)
  createdByUserId!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType()
export class CreateSfCrmAccountInput {
  @Field(() => String) name!: string;
  @Field(() => String, { nullable: true }) website?: string | null;
  @Field(() => String, { nullable: true }) industry?: string | null;
  @Field(() => String, { nullable: true }) notes?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class UpdateSfCrmAccountInput {
  @Field(() => String, { nullable: true }) name?: string | null;
  @Field(() => String, { nullable: true }) website?: string | null;
  @Field(() => String, { nullable: true }) industry?: string | null;
  @Field(() => String, { nullable: true }) notes?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class CreateSfCrmContactInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => String) firstName!: string;
  @Field(() => String, { nullable: true }) lastName?: string | null;
  @Field(() => String, { nullable: true }) email?: string | null;
  @Field(() => String, { nullable: true }) phone?: string | null;
  @Field(() => String, { nullable: true }) title?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class UpdateSfCrmContactInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => String, { nullable: true }) firstName?: string | null;
  @Field(() => String, { nullable: true }) lastName?: string | null;
  @Field(() => String, { nullable: true }) email?: string | null;
  @Field(() => String, { nullable: true }) phone?: string | null;
  @Field(() => String, { nullable: true }) title?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class CreateSfCrmDealStageInput {
  @Field(() => String, { nullable: true }) pipelineKey?: string | null;
  @Field(() => String) name!: string;
  @Field(() => Int, { nullable: true }) sortOrder?: number | null;
}

@InputType()
export class UpdateSfCrmDealStageInput {
  @Field(() => String, { nullable: true }) name?: string | null;
  @Field(() => Int, { nullable: true }) sortOrder?: number | null;
}

@InputType()
export class CreateSfCrmDealInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => ID, { nullable: true }) contactId?: string | null;
  @Field(() => ID) stageId!: string;
  @Field(() => String) name!: string;
  @Field(() => Float, { nullable: true }) value?: number | null;
  @Field(() => String, { nullable: true }) currency?: string | null;
  @Field(() => Int, { nullable: true }) probability?: number | null;
  @Field(() => GraphQLISODateTime, { nullable: true })
  expectedCloseAt?: Date | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class UpdateSfCrmDealInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => ID, { nullable: true }) contactId?: string | null;
  @Field(() => ID, { nullable: true }) stageId?: string | null;
  @Field(() => String, { nullable: true }) name?: string | null;
  @Field(() => Float, { nullable: true }) value?: number | null;
  @Field(() => String, { nullable: true }) currency?: string | null;
  @Field(() => Int, { nullable: true }) probability?: number | null;
  @Field(() => GraphQLISODateTime, { nullable: true })
  expectedCloseAt?: Date | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class CreateSfCrmActivityInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => ID, { nullable: true }) contactId?: string | null;
  @Field(() => ID, { nullable: true }) dealId?: string | null;
  @Field(() => SfCrmActivityType) type!: SfCrmActivityType;
  @Field(() => String, { nullable: true }) subject?: string | null;
  @Field(() => String, { nullable: true }) body?: string | null;
  @Field(() => GraphQLISODateTime, { nullable: true }) dueAt?: Date | null;
}

@InputType()
export class UpdateSfCrmActivityInput {
  @Field(() => SfCrmActivityType, { nullable: true }) type?: SfCrmActivityType;
  @Field(() => String, { nullable: true }) subject?: string | null;
  @Field(() => String, { nullable: true }) body?: string | null;
  @Field(() => GraphQLISODateTime, { nullable: true }) dueAt?: Date | null;
  @Field(() => GraphQLISODateTime, { nullable: true })
  completedAt?: Date | null;
}
