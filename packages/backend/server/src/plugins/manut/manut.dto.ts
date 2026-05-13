import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnProjectStatus } from '@prisma/client';

registerEnumType(MnProjectStatus, {
  name: 'MnProjectStatus',
  description: 'Lifecycle state of a Superflow project.',
});

@ObjectType('MnProject')
export class MnProjectObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => MnProjectStatus)
  status!: MnProjectStatus;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType()
export class ImportSuperflowHandoverInput {
  @Field(() => String)
  handoverJson!: string;

  @Field(() => ID, { nullable: true })
  targetDocId?: string | null;
}

@ObjectType()
export class ImportSuperflowHandoverResult {
  @Field(() => ID)
  docId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => Boolean)
  updated!: boolean;
}
