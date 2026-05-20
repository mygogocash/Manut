import {
  createUnionType,
  Field,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';
import type { User } from '@prisma/client';

import {
  PublicUser,
  UserSettings,
  UserSettingsInput,
  WorkspaceUser,
} from '../../models';
import { type CurrentUser } from '../auth/session';

@ObjectType()
export class UserType implements CurrentUser {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'User name' })
  name!: string;

  @Field({ description: 'User email' })
  email!: string;

  @Field(() => String, { description: 'User avatar url', nullable: true })
  avatarUrl!: string | null;

  @Field(() => Boolean, {
    description: 'User email verified',
  })
  emailVerified!: boolean;

  @Field(() => Boolean, {
    description: 'User password has been set',
    nullable: true,
  })
  hasPassword!: boolean | null;

  @Field(() => Date, {
    deprecationReason: 'useless',
    description: 'User email verified',
    nullable: true,
  })
  createdAt?: Date | null;

  @Field(() => Boolean, {
    description: 'User is disabled',
  })
  disabled!: boolean;

  @Field(() => Boolean, {
    description:
      'Whether the user has finished (or skipped) the /welcome onboarding wizard. Used by the frontend index router to decide whether to drop a brand-new account into /welcome or into their landing workspace.',
  })
  completedOnboarding!: boolean;
}

@ObjectType()
export class PublicUserType implements PublicUser {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;
}

@ObjectType()
export class WorkspaceUserType implements WorkspaceUser {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;
}

@ObjectType()
export class LimitedUserType implements Partial<User> {
  @Field({ description: 'User email' })
  email!: string;

  @Field(() => Boolean, {
    description: 'User password has been set',
    nullable: true,
  })
  hasPassword!: boolean | null;
}

export const UserOrLimitedUser = createUnionType({
  name: 'UserOrLimitedUser',
  types: () => [UserType, LimitedUserType] as const,
  resolveType(value) {
    if (value.id) {
      return UserType;
    }
    return LimitedUserType;
  },
});

@ObjectType()
export class DeleteAccount {
  @Field()
  success!: boolean;
}
@ObjectType()
export class RemoveAvatar {
  @Field()
  success!: boolean;
}

@ObjectType()
export class UserSettingsType implements UserSettings {
  @Field({ description: 'Receive invitation email' })
  receiveInvitationEmail!: boolean;

  @Field({ description: 'Receive mention email' })
  receiveMentionEmail!: boolean;

  @Field({ description: 'Receive comment email' })
  receiveCommentEmail!: boolean;

  @Field({ description: 'Personalize text appended to AI prompts' })
  personalize!: string;
}

@InputType()
export class UpdateUserInput implements Partial<User> {
  @Field({ description: 'User name', nullable: true })
  name?: string;
}

/**
 * Input for the {@link UserResolver.updateOnboarding} mutation. Wave 2 B6 —
 * persisted by the /welcome wizard once the user clicks "Create my workspace"
 * or "Skip", so we don't bounce them back into the wizard on next sign-in.
 *
 * Each field is annotated with an EXPLICIT type to avoid the NestJS
 * `UndefinedTypeError` trap that bit the v1.7.0 and v1.10.2 deploys. See
 * CLAUDE.md §6 "GraphQL `@Field` UndefinedTypeError — broken TWICE now".
 */
@InputType()
export class UpdateOnboardingInput {
  @Field(() => Boolean, {
    nullable: true,
    description:
      'Whether the user has completed (or skipped) the /welcome onboarding wizard.',
  })
  completedOnboarding?: boolean | null;
}

@InputType()
export class ManageUserInput {
  @Field({ description: 'User email', nullable: true })
  email?: string;

  @Field({ description: 'User name', nullable: true })
  name?: string;
}

@InputType()
export class UpdateUserSettingsInput implements UserSettingsInput {
  @Field({ description: 'Receive invitation email', nullable: true })
  receiveInvitationEmail?: boolean;

  @Field({ description: 'Receive mention email', nullable: true })
  receiveMentionEmail?: boolean;

  @Field({ description: 'Receive comment email', nullable: true })
  receiveCommentEmail?: boolean;
}
