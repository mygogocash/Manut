import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';

/**
 * GraphQL surface for the Manut Agent Registry. Each workspace gets the
 * 5 canonical operating roles (Release Captain, Builder, Verifier,
 * Deployer, Historian) seeded into mn_agent_roles. The DTOs here back
 * the read query (agentRoles) and the targeted update mutation
 * (updateAgentRole).
 *
 * EVERY nullable @Field uses explicit `() => Type` per CLAUDE.md §5
 * (UndefinedTypeError trap, broken twice on this codebase).
 */
@ObjectType('MnAgentRole')
export class MnAgentRoleObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String, {
    description:
      'Stable identifier (e.g. "release-captain"). Immutable — used by automation.',
  })
  slug!: string;

  @Field(() => String)
  displayName!: string;

  @Field(() => String)
  adapter!: string;

  @Field(() => String)
  responsibility!: string;

  @Field(() => String, { nullable: true })
  escalation!: string | null;

  @Field(() => String, { nullable: true })
  lastSuccessfulRunId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSeenAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType('UpdateMnAgentRoleInput')
export class UpdateMnAgentRoleInput {
  @Field(() => String, { nullable: true })
  displayName?: string | null;

  @Field(() => String, { nullable: true })
  adapter?: string | null;

  @Field(() => String, { nullable: true })
  responsibility?: string | null;

  @Field(() => String, { nullable: true })
  escalation?: string | null;
}
