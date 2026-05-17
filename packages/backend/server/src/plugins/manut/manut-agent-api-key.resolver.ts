import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  MintedMnAgentApiKeyObjectType,
  MintMnAgentApiKeyInput,
  MnAgentApiKeyObjectType,
} from './manut-agent.dto';
import { MnAgentService } from './manut-agent.service';
import { MnAgentApiKeyService } from './manut-agent-api-key.service';

/**
 * GraphQL surface for Manut agent API keys.
 *
 * `mintMnAgentApiKey` returns the plaintext ONCE — clients must
 * capture it immediately; subsequent reads via `mnAgentApiKeys` only
 * surface metadata (id, name, timestamps, revokedAt). See
 * `MnAgentApiKeyService` for the hash design note.
 */
@Resolver(() => MnAgentApiKeyObjectType)
export class MnAgentApiKeyResolver {
  constructor(
    private readonly service: MnAgentApiKeyService,
    private readonly agents: MnAgentService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnAgentApiKeyObjectType], {
    description:
      'List API keys for an agent. Includes revoked keys so the audit ' +
      'trail stays visible.',
  })
  async mnAgentApiKeys(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string
  ): Promise<MnAgentApiKeyObjectType[]> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Read');
    return this.service.list(workspaceId, agentId) as Promise<
      MnAgentApiKeyObjectType[]
    >;
  }

  @Mutation(() => MintedMnAgentApiKeyObjectType, {
    description:
      'Mint a new API key. The plaintext is shown ONCE in the response ' +
      'and is never recoverable from the server again.',
  })
  async mintMnAgentApiKey(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('input', { type: () => MintMnAgentApiKeyInput })
    input: MintMnAgentApiKeyInput
  ): Promise<MintedMnAgentApiKeyObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    // Echo `getOrThrow` so we 404 on a cross-tenant agentId guess
    // before consuming a UUID — keeps the audit log clean.
    await this.agents.getOrThrow(workspaceId, agentId);
    const { key, plaintext } = await this.service.mint(
      workspaceId,
      agentId,
      input
    );
    return { key: key as MnAgentApiKeyObjectType, plaintext };
  }

  @Mutation(() => MnAgentApiKeyObjectType, {
    description:
      'Soft-revoke an API key. Idempotent — re-revoking a revoked key ' +
      'returns the existing row unchanged.',
  })
  async revokeMnAgentApiKey(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('keyId', { type: () => ID }) keyId: string
  ): Promise<MnAgentApiKeyObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.revoke(
      workspaceId,
      agentId,
      keyId
    ) as Promise<MnAgentApiKeyObjectType>;
  }
}
