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

  // Picrew/Avataaars-style avatar configuration. The shape is a free-form JSON
  // object (topType, hairColor, eyeType, etc.) — the server does not validate
  // keys/values; the avataaars renderer falls back to defaults for unknowns.
  @Field(() => GraphQLJSONObject)
  avatar!: Record<string, unknown>;

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

  // Optional initial avatar; defaults to {} when omitted. See AgentType.avatar.
  @Field(() => GraphQLJSONObject, { nullable: true })
  avatar?: Record<string, unknown>;
}

@InputType('AgentLinkInput')
export class AgentLinkInput {
  @Field(() => String)
  url!: string;

  @Field(() => String, { nullable: true })
  label?: string;
}

@InputType()
export class UpdateAgentInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  instructions?: string;

  // Bulk-replace fields used by the detail page Skills / Links / Files
  // sections. Add/remove single-item mutations remain for callers that
  // want optimistic single-item updates.
  @Field(() => [String], { nullable: true })
  skills?: string[];

  @Field(() => [AgentLinkInput], { nullable: true })
  links?: AgentLinkInput[];

  @Field(() => [String], { nullable: true })
  files?: string[];

  // Free-form avatar config object. See AgentType.avatar.
  @Field(() => GraphQLJSONObject, { nullable: true })
  avatar?: Record<string, unknown>;
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
