import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnBudgetScope } from '@prisma/client';
import { z } from 'zod';

/**
 * M4 budget GraphQL + Zod surface.
 *
 * CLAUDE.md scars honored:
 *  - Every nullable @Field uses explicit `() => Type` (v1.7.0/v1.10.2
 *    UndefinedTypeError trap).
 *  - Money is always cents (Int), never a float, so budget comparisons
 *    are exact.
 *  - `monthYear` is a YYYY-MM literal (six chars + dash). The Zod regex
 *    rejects malformed input at the service boundary so the enforcer
 *    cache never holds a nonsense key.
 */

registerEnumType(MnBudgetScope, {
  name: 'MnBudgetScope',
  description:
    'Scope on which a budget cap is enforced. The enforcer walks ' +
    'task → goal → agent → project → workspace; first hard-stop hit wins.',
});

const MONTH_YEAR_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// ---------------------------------------------------------------------------
// Zod schemas — source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const CreateMnBudgetSchema = z.object({
  scopeType: z.nativeEnum(MnBudgetScope),
  scopeId: z.string().min(1).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  monthYear: z.string().regex(MONTH_YEAR_PATTERN, 'expected YYYY-MM'),
  capCents: z.number().int().nonnegative(),
  warnThresholdPct: z.number().int().min(0).max(100).optional(),
  hardStopEnabled: z.boolean().optional(),
});

export type CreateMnBudgetValues = z.infer<typeof CreateMnBudgetSchema>;

export const UpdateMnBudgetSchema = z.object({
  capCents: z.number().int().nonnegative().optional(),
  warnThresholdPct: z.number().int().min(0).max(100).optional(),
  hardStopEnabled: z.boolean().optional(),
});

export type UpdateMnBudgetValues = z.infer<typeof UpdateMnBudgetSchema>;

// ---------------------------------------------------------------------------
// GraphQL — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('CreateMnBudgetInput')
export class CreateMnBudgetInput {
  @Field(() => MnBudgetScope)
  scopeType!: MnBudgetScope;

  @Field(() => ID, {
    nullable: true,
    description:
      'Identifier for the entity at `scopeType`. NULL for workspace-level budgets.',
  })
  scopeId?: string | null;

  @Field(() => ID, {
    nullable: true,
    description:
      'Optional project context. Required for PROJECT scope; may be unset for WORKSPACE scope.',
  })
  projectId?: string | null;

  @Field(() => String, {
    description: 'Calendar month in YYYY-MM (e.g. "2026-05").',
  })
  monthYear!: string;

  @Field(() => Int, {
    description: 'Spending cap in USD cents (integer). Negative not allowed.',
  })
  capCents!: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Warning threshold as integer percent of cap (0–100). Defaults to 80.',
  })
  warnThresholdPct?: number | null;

  @Field(() => Boolean, {
    nullable: true,
    description:
      'When true (default), reaching capCents blocks new spend on this scope.',
  })
  hardStopEnabled?: boolean | null;
}

@InputType('UpdateMnBudgetInput')
export class UpdateMnBudgetInput {
  @Field(() => Int, { nullable: true })
  capCents?: number | null;

  @Field(() => Int, { nullable: true })
  warnThresholdPct?: number | null;

  @Field(() => Boolean, { nullable: true })
  hardStopEnabled?: boolean | null;
}

@ObjectType('MnBudget')
export class MnBudgetObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID, { nullable: true })
  projectId!: string | null;

  @Field(() => MnBudgetScope)
  scopeType!: MnBudgetScope;

  @Field(() => ID, { nullable: true })
  scopeId!: string | null;

  @Field(() => String)
  monthYear!: string;

  @Field(() => Int)
  capCents!: number;

  @Field(() => Int)
  spentCents!: number;

  @Field(() => Int)
  warnThresholdPct!: number;

  @Field(() => Boolean)
  hardStopEnabled!: boolean;

  @Field(() => Boolean)
  alertSent!: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('MnCostEvent')
export class MnCostEventObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID, { nullable: true })
  projectId!: string | null;

  @Field(() => ID, { nullable: true })
  agentId!: string | null;

  @Field(() => ID, { nullable: true })
  taskId!: string | null;

  @Field(() => ID, { nullable: true })
  goalId!: string | null;

  @Field(() => String, { nullable: true })
  billingCode!: string | null;

  @Field(() => String)
  provider!: string;

  @Field(() => String)
  model!: string;

  @Field(() => Int)
  inputTokens!: number;

  @Field(() => Int)
  outputTokens!: number;

  @Field(() => Int)
  costCents!: number;

  @Field(() => GraphQLISODateTime)
  occurredAt!: Date;
}

/**
 * Aggregated spend rollup for a budget. Returned by the dashboard query
 * so the UI can render a project row without re-summing on the client.
 */
@ObjectType('MnBudgetRollup')
export class MnBudgetRollupObjectType {
  @Field(() => MnBudgetScope)
  scopeType!: MnBudgetScope;

  @Field(() => ID, { nullable: true })
  scopeId!: string | null;

  @Field(() => ID, { nullable: true })
  projectId!: string | null;

  @Field(() => String)
  monthYear!: string;

  @Field(() => Int)
  capCents!: number;

  @Field(() => Int)
  spentCents!: number;

  @Field(() => Int, {
    description:
      'Convenience: `Math.min(100, Math.floor(spent / cap * 100))`. ' +
      '0 when capCents is 0.',
  })
  utilizationPct!: number;
}
