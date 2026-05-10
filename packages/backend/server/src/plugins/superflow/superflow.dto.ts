import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { SfProjectStatus } from '@prisma/client';

registerEnumType(SfProjectStatus, {
  name: 'SfProjectStatus',
  description: 'Lifecycle state of a Superflow project.',
});

@ObjectType('SfProject')
export class SfProjectObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => SfProjectStatus)
  status!: SfProjectStatus;

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
