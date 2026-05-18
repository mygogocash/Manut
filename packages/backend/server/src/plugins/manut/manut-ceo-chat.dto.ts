/**
 * M17 — CEO Chat DTOs.
 *
 * CLAUDE.md scars honored:
 *  - Every `@Field` on a nullable / optional declaration passes an
 *    EXPLICIT `() => Type` arrow. NestJS reflection cannot infer a
 *    GraphQL type from a TypeScript `string | null` union alone
 *    (v1.7.0 + v1.10.2 UndefinedTypeError scars). The smoke spec in
 *    `__tests__/manut/m17-ceo-chat-service.spec.ts` rejects any
 *    `@Field({ ... })` shape that omits the arrow.
 *  - `MnCeoResolutionKind` / `MnCeoTurnRole` are RUNTIME imports from
 *    `@prisma/client` because they are passed as enum values to
 *    `registerEnumType` (NestJS reads them at module init). Type-only
 *    imports would silently break the GraphQL schema build at runtime.
 */
import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnCeoResolutionKind, MnCeoTurnRole } from '@prisma/client';

registerEnumType(MnCeoResolutionKind, {
  name: 'MnCeoResolutionKind',
  description:
    'M17 — typed resolution emitted by the CEO agent for a user turn.',
});

registerEnumType(MnCeoTurnRole, {
  name: 'MnCeoTurnRole',
  description: 'M17 — speaker role on a CEO Chat turn.',
});

@InputType()
export class CreateMnCeoConversationInput {
  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  title?: string | null;
}

@InputType()
export class AddMnCeoTurnInput {
  @Field(() => ID)
  conversationId!: string;

  @Field(() => MnCeoTurnRole)
  role!: MnCeoTurnRole;

  @Field(() => String)
  bodyMd!: string;
}

@ObjectType('MnCeoConversation')
export class MnCeoConversationObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  ownerUserId!: string;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => MnCeoResolutionKind, { nullable: true })
  lastResolutionKind!: MnCeoResolutionKind | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('MnCeoTurn')
export class MnCeoTurnObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => MnCeoTurnRole)
  role!: MnCeoTurnRole;

  @Field(() => String)
  bodyMd!: string;

  @Field(() => MnCeoResolutionKind)
  resolutionKind!: MnCeoResolutionKind;

  @Field(() => String, { nullable: true })
  resolutionRefId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
