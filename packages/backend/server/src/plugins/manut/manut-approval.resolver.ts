import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnApprovalCommentInput,
  CreateMnApprovalInput,
  DecideMnApprovalInput,
  ListMnApprovalsInput,
  MnApprovalCommentObjectType,
  MnApprovalObjectType,
} from './manut-approval.dto';
import { MnApprovalService } from './manut-approval.service';
import { MnApprovalCommentService } from './manut-approval-comment.service';

/**
 * GraphQL surface for M3 approvals + comments.
 *
 * Every nullable @Field on the DTOs uses the explicit `() => Type` form
 * per CLAUDE.md §6 (UndefinedTypeError trap). Permissions are checked
 * via `AccessController` BEFORE the service call so the service can
 * stay focused on data invariants. The five resolver classes below
 * (queries, mutations, comments) all live in this file because they're
 * thin wrappers — keeping them split out into different files makes
 * the trap-guard test (`m3-module-init.spec.ts`) walk more files for
 * no behavioural win.
 */
@Resolver(() => MnApprovalObjectType)
export class MnApprovalResolver {
  constructor(
    private readonly service: MnApprovalService,
    private readonly comments: MnApprovalCommentService,
    private readonly ac: AccessController
  ) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  @Query(() => [MnApprovalObjectType], {
    description:
      'List approvals for a workspace inbox. Filterable by project, ' +
      'status, type, or requesting agent. Workspace-scoped.',
  })
  async mnApprovals(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('filter', { type: () => ListMnApprovalsInput, nullable: true })
    filter?: ListMnApprovalsInput | null
  ): Promise<MnApprovalObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.list(workspaceId, {
      projectId: filter?.projectId ?? null,
      statuses: filter?.statuses ?? null,
      types: filter?.types ?? null,
      requestedByAgentId: filter?.requestedByAgentId ?? null,
      limit: filter?.limit ?? null,
    }) as Promise<MnApprovalObjectType[]>;
  }

  @Query(() => MnApprovalObjectType, {
    nullable: true,
    description:
      'Fetch a single approval by id. Returns null when the approval ' +
      'does not exist or belongs to another workspace (no info leak).',
  })
  async mnApproval(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('approvalId', { type: () => ID }) approvalId: string
  ): Promise<MnApprovalObjectType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.get(
      workspaceId,
      approvalId
    ) as Promise<MnApprovalObjectType | null>;
  }

  @Query(() => [MnApprovalCommentObjectType], {
    description:
      'List comments on an approval, oldest first. Cross-workspace ' +
      'lookups throw NotFoundException (matches the approval surface).',
  })
  async mnApprovalComments(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('approvalId', { type: () => ID }) approvalId: string
  ): Promise<MnApprovalCommentObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.comments.list(workspaceId, approvalId) as Promise<
      MnApprovalCommentObjectType[]
    >;
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  @Mutation(() => MnApprovalObjectType, {
    description:
      'Create a new PENDING approval. Requires Workspace.Settings.Update.',
  })
  async createMnApproval(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => CreateMnApprovalInput })
    input: CreateMnApprovalInput
  ): Promise<MnApprovalObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.create(
      workspaceId,
      user.id,
      input
    ) as Promise<MnApprovalObjectType>;
  }

  @Mutation(() => MnApprovalObjectType, {
    description:
      'Decide an approval (APPROVED / REJECTED / CANCELLED / REVISION_REQUESTED). ' +
      'Terminal-state approvals are immutable.',
  })
  async decideMnApproval(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('approvalId', { type: () => ID }) approvalId: string,
    @Args('input', { type: () => DecideMnApprovalInput })
    input: DecideMnApprovalInput
  ): Promise<MnApprovalObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.decide(
      workspaceId,
      approvalId,
      user.id,
      input
    ) as Promise<MnApprovalObjectType>;
  }

  @Mutation(() => MnApprovalObjectType, {
    description:
      'Resubmit a REVISION_REQUESTED approval. Optionally overwrites ' +
      'the payload with the revised version. Status returns to PENDING.',
  })
  async submitMnApprovalRevision(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('approvalId', { type: () => ID }) approvalId: string,
    @Args('payload', { type: () => GraphQLJSONObject, nullable: true })
    payload?: Record<string, unknown> | null
  ): Promise<MnApprovalObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.submitRevision(
      workspaceId,
      approvalId,
      payload ?? null
    ) as Promise<MnApprovalObjectType>;
  }

  @Mutation(() => MnApprovalCommentObjectType, {
    description: 'Add a comment to an approval thread.',
  })
  async createMnApprovalComment(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('approvalId', { type: () => ID }) approvalId: string,
    @Args('input', { type: () => CreateMnApprovalCommentInput })
    input: CreateMnApprovalCommentInput
  ): Promise<MnApprovalCommentObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.comments.create(
      workspaceId,
      approvalId,
      user.id,
      input
    ) as Promise<MnApprovalCommentObjectType>;
  }
}
