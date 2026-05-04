import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

/**
 * GraphQL mirror of the Prisma SocialConnection / SocialPlatform / ConnectionStatus
 * shapes added in agent 1's schema.prisma additions (PRD §5).
 *
 * Enum values must stay in sync with the Prisma enums.
 */

export enum SocialPlatform {
  FACEBOOK = 'FACEBOOK',
  INSTAGRAM = 'INSTAGRAM',
  THREADS = 'THREADS',
  TIKTOK = 'TIKTOK',
  LINE_VOOM = 'LINE_VOOM',
  GOGOCASH = 'GOGOCASH',
}

registerEnumType(SocialPlatform, {
  name: 'SocialPlatform',
  description: 'Connected analytics platform.',
});

export enum ConnectionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
}

registerEnumType(ConnectionStatus, {
  name: 'ConnectionStatus',
  description: 'Lifecycle state of a workspace platform connection.',
});

@ObjectType('SocialConnection')
export class SocialConnectionObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => SocialPlatform)
  platform!: SocialPlatform;

  @Field(() => ConnectionStatus)
  status!: ConnectionStatus;

  @Field(() => String)
  externalAccountId!: string;

  @Field(() => String)
  externalAccountName!: string;

  @Field(() => [String])
  scopes!: string[];

  @Field(() => String)
  connectedByUserId!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSyncAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastErrorAt!: Date | null;

  @Field(() => String, { nullable: true })
  lastError!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
