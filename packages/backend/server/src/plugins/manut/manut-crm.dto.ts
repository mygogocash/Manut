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
import { MnCrmActivityType } from '@prisma/client';

registerEnumType(MnCrmActivityType, {
  name: 'MnCrmActivityType',
  description: 'CRM activity category.',
});

@ObjectType('MnCrmAccount')
export class MnCrmAccountObjectType {
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

@ObjectType('MnCrmContact')
export class MnCrmContactObjectType {
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

@ObjectType('MnCrmDealStage')
export class MnCrmDealStageObjectType {
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

@ObjectType('MnCrmDeal')
export class MnCrmDealObjectType {
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

@ObjectType('MnCrmActivity')
export class MnCrmActivityObjectType {
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

  @Field(() => MnCrmActivityType)
  type!: MnCrmActivityType;

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
export class CreateMnCrmAccountInput {
  @Field(() => String) name!: string;
  @Field(() => String, { nullable: true }) website?: string | null;
  @Field(() => String, { nullable: true }) industry?: string | null;
  @Field(() => String, { nullable: true }) notes?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class UpdateMnCrmAccountInput {
  @Field(() => String, { nullable: true }) name?: string | null;
  @Field(() => String, { nullable: true }) website?: string | null;
  @Field(() => String, { nullable: true }) industry?: string | null;
  @Field(() => String, { nullable: true }) notes?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class CreateMnCrmContactInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => String) firstName!: string;
  @Field(() => String, { nullable: true }) lastName?: string | null;
  @Field(() => String, { nullable: true }) email?: string | null;
  @Field(() => String, { nullable: true }) phone?: string | null;
  @Field(() => String, { nullable: true }) title?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class UpdateMnCrmContactInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => String, { nullable: true }) firstName?: string | null;
  @Field(() => String, { nullable: true }) lastName?: string | null;
  @Field(() => String, { nullable: true }) email?: string | null;
  @Field(() => String, { nullable: true }) phone?: string | null;
  @Field(() => String, { nullable: true }) title?: string | null;
  @Field(() => ID, { nullable: true }) ownerUserId?: string | null;
}

@InputType()
export class CreateMnCrmDealStageInput {
  @Field(() => String, { nullable: true }) pipelineKey?: string | null;
  @Field(() => String) name!: string;
  @Field(() => Int, { nullable: true }) sortOrder?: number | null;
}

@InputType()
export class UpdateMnCrmDealStageInput {
  @Field(() => String, { nullable: true }) name?: string | null;
  @Field(() => Int, { nullable: true }) sortOrder?: number | null;
}

@InputType()
export class CreateMnCrmDealInput {
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
export class UpdateMnCrmDealInput {
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
export class CreateMnCrmActivityInput {
  @Field(() => ID, { nullable: true }) accountId?: string | null;
  @Field(() => ID, { nullable: true }) contactId?: string | null;
  @Field(() => ID, { nullable: true }) dealId?: string | null;
  @Field(() => MnCrmActivityType) type!: MnCrmActivityType;
  @Field(() => String, { nullable: true }) subject?: string | null;
  @Field(() => String, { nullable: true }) body?: string | null;
  @Field(() => GraphQLISODateTime, { nullable: true }) dueAt?: Date | null;
}

@InputType()
export class UpdateMnCrmActivityInput {
  @Field(() => MnCrmActivityType, { nullable: true }) type?: MnCrmActivityType;
  @Field(() => String, { nullable: true }) subject?: string | null;
  @Field(() => String, { nullable: true }) body?: string | null;
  @Field(() => GraphQLISODateTime, { nullable: true }) dueAt?: Date | null;
  @Field(() => GraphQLISODateTime, { nullable: true })
  completedAt?: Date | null;
}
