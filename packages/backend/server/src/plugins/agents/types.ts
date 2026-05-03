import {
  Field,
  GraphQLISODateTime,
  InputType,
  ObjectType,
} from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';

@ObjectType('AgentLink')
export class AgentLinkType {
  @Field()
  url!: string;

  @Field(() => String, { nullable: true })
  label?: string;
}

@ObjectType('Agent')
export class AgentType {
  @Field()
  id!: string;

  @Field()
  workspaceId!: string;

  @Field()
  ownerId!: string;

  @Field(() => String, { nullable: true })
  parentAgentId?: string | null;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  instructions!: string;

  @Field(() => [String])
  skills!: string[];

  @Field(() => [AgentLinkType])
  links!: AgentLinkType[];

  @Field(() => [String])
  files!: string[];

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType()
export class CreateAgentInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  parentAgentId?: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  instructions?: string;
}

@InputType()
export class UpdateAgentInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  instructions?: string;
}

// Re-export so callers can write `import { GraphQLJSONObject } from './types'` if needed.
export { GraphQLJSONObject };

export interface AgentLink {
  url: string;
  label?: string;
}

/**
 * Maximum depth allowed in a sub-agent chain. We refuse to create sub-agents
 * deeper than this to prevent runaway recursion / accidental deep trees.
 */
export const MAX_SUB_AGENT_DEPTH = 4;
