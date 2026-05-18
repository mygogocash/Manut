import { NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { MnAgentMaximizerToggleResultObjectType } from './manut-maximizer.dto';
import { MnMaximizerService } from './manut-maximizer.service';

/**
 * M12 — GraphQL surface for the MAXIMIZER MODE toggle.
 *
 * `enableMnAgentMaximizer` / `disableMnAgentMaximizer` are the only
 * write surface for the flag. Reading the flag is folded into the
 * existing `mnAgent` query — there's no separate read mutation because
 * the column is small and the frontend already selects the full
 * MnAgent shape.
 *
 * Permission: `Workspace.Settings.Update` on the agent's workspace.
 * The agent's workspace is loaded BEFORE the assertion so an attempt
 * to flip an agent in a workspace the caller doesn't belong to gets a
 * Forbidden error (not a missing-record NotFound — those reveal less
 * information about cross-workspace existence).
 *
 * Per CLAUDE.md §6 UndefinedTypeError trap: every `@Field` on
 * `MnAgentMaximizerToggleResultObjectType` carries an explicit
 * `() => Type`. Args use the explicit `{ type: () => ID }` form per
 * the same scar.
 *
 * Per PR #57 (NestJS DI): `PrismaClient`, `AccessController`, and
 * `MnMaximizerService` are RUNTIME imports (no `import type`) because
 * they're constructor-injection targets.
 */
@Resolver(() => MnAgentMaximizerToggleResultObjectType)
export class MnMaximizerResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly service: MnMaximizerService,
    private readonly ac: AccessController
  ) {}

  @Mutation(() => MnAgentMaximizerToggleResultObjectType, {
    description:
      'M12 — enable MAXIMIZER MODE on an agent. While on, the dispatch ' +
      'orchestrator auto-delegates capability-matched calls to ' +
      'subordinates, batches the rest into 10-call heartbeat groups, ' +
      'forces approval for any call costing >50% of remaining monthly ' +
      'budget, and runs full M11 outcome verification on every DONE ' +
      'transition. Requires Workspace.Settings.Update.',
  })
  async enableMnAgentMaximizer(
    @CurrentUser() user: CurrentUser,
    @Args('agentId', { type: () => ID }) agentId: string
  ): Promise<MnAgentMaximizerToggleResultObjectType> {
    const workspaceId = await this.requireAgentWorkspace(agentId);
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const next = await this.service.enable(agentId);
    return { agentId, maximizerMode: next };
  }

  @Mutation(() => MnAgentMaximizerToggleResultObjectType, {
    description:
      'M12 — disable MAXIMIZER MODE on an agent and revert the dispatch ' +
      'path to upstream behavior. Requires Workspace.Settings.Update.',
  })
  async disableMnAgentMaximizer(
    @CurrentUser() user: CurrentUser,
    @Args('agentId', { type: () => ID }) agentId: string
  ): Promise<MnAgentMaximizerToggleResultObjectType> {
    const workspaceId = await this.requireAgentWorkspace(agentId);
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const next = await this.service.disable(agentId);
    return { agentId, maximizerMode: next };
  }

  /**
   * Load the agent's workspaceId in a single round-trip so the
   * permission check can run before any state mutation. Returns the
   * workspaceId; throws NotFoundException when the agent is missing.
   */
  private async requireAgentWorkspace(agentId: string): Promise<string> {
    const agent = await this.db.mnAgent.findUnique({
      where: { id: agentId },
      select: { workspaceId: true },
    });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }
    return agent.workspaceId;
  }
}
