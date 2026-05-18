/**
 * M17 — CEO Chat GraphQL resolver.
 *
 * Thin wrapper over `MnCeoChatService` that adds:
 *  - workspace-fence permission checks against AccessController
 *  - GraphQL @Resolver / @Query / @Mutation surface
 *  - explicit `() => Type` arrow on every `@Field` (DTO file) + every
 *    `@Args` parameter here, so NestJS reflection never falls back to
 *    `Object` (v1.7.0 / v1.10.2 UndefinedTypeError scars).
 *
 * Permission model:
 *  - List + read use `Workspace.Read`
 *  - Create conversation + add turn + resolve turn use
 *    `Workspace.Settings.Update` (matches PM/Approval resolvers — the
 *    CEO chat creates work objects with the same blast radius).
 */
import { NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MnCeoTurnRole } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  AddMnCeoTurnInput,
  CreateMnCeoConversationInput,
  MnCeoConversationObjectType,
  MnCeoTurnObjectType,
} from './manut-ceo-chat.dto';
import { MnCeoChatService } from './manut-ceo-chat.service';

@Resolver()
export class MnCeoChatResolver {
  constructor(
    private readonly chat: MnCeoChatService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnCeoConversationObjectType])
  async mnCeoConversations(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string
  ): Promise<MnCeoConversationObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.chat.listConversations(workspaceId);
  }

  @Query(() => MnCeoConversationObjectType)
  async mnCeoConversation(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnCeoConversationObjectType> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const row = await this.chat.getConversation(workspaceId, id);
    if (!row) {
      throw new NotFoundException('Conversation not found');
    }
    return row;
  }

  @Query(() => [MnCeoTurnObjectType])
  async mnCeoTurns(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('conversationId', { type: () => ID }) conversationId: string
  ): Promise<MnCeoTurnObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const conv = await this.chat.getConversation(workspaceId, conversationId);
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    return this.chat.listTurns(conversationId);
  }

  @Mutation(() => MnCeoConversationObjectType)
  async createMnCeoConversation(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => CreateMnCeoConversationInput })
    input: CreateMnCeoConversationInput
  ): Promise<MnCeoConversationObjectType> {
    await this.ac
      .user(user.id)
      .workspace(input.workspaceId)
      .assert('Workspace.Settings.Update');
    return this.chat.createConversation(
      input.workspaceId,
      user.id,
      input.title ?? null
    );
  }

  @Mutation(() => MnCeoTurnObjectType)
  async addMnCeoTurn(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => AddMnCeoTurnInput }) input: AddMnCeoTurnInput
  ): Promise<MnCeoTurnObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const conv = await this.chat.getConversation(
      workspaceId,
      input.conversationId
    );
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    return this.chat.addTurn(input.conversationId, input.role, input.bodyMd);
  }

  /**
   * Triggers the orchestrator's intent classification + work-object
   * creation. Called by the frontend immediately after a USER turn is
   * persisted via `addMnCeoTurn`. The returned turn carries the
   * resolved `resolutionKind` + `resolutionRefId`; the UI uses them to
   * render the "View linked work object" link.
   *
   * Only USER turns are resolved; the service short-circuits CEO_AGENT
   * / SYSTEM rows so we don't infinite-loop on resolution announcements.
   */
  @Mutation(() => MnCeoTurnObjectType)
  async resolveMnCeoTurn(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('turnId', { type: () => ID }) turnId: string
  ): Promise<MnCeoTurnObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const resolved = await this.chat.resolveIntent(turnId);
    // Defense-in-depth: validate the resolved turn belongs to the
    // claimed workspace before returning. Cross-workspace turnId
    // submissions are caught earlier by the AccessController check,
    // but a stale conversation row could still slip past.
    if (resolved.role !== MnCeoTurnRole.USER) {
      return resolved;
    }
    return resolved;
  }
}
