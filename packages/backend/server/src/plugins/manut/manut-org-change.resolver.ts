import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  DecideMnOrgChangeInput,
  ListMnOrgChangesInput,
  MnOrgChangeObjectType,
  ProposeMnOrgChangeInput,
} from './manut-org-change.dto';
import { MnOrgChangeService } from './manut-org-change.service';

/**
 * GraphQL surface for M15 self-organization.
 *
 * Every nullable @Field on the DTOs uses the explicit `() => Type`
 * form per CLAUDE.md §6 (UndefinedTypeError trap). Permissions are
 * checked via `AccessController` BEFORE the service call so the
 * service stays focused on data invariants.
 *
 * R-tier: propose() + decide() are R1 (governance writes, audited).
 * apply() is R1 (mutates structural tables; reversible via revert()).
 * revert() is R1 (mutates structural tables back; idempotent).
 * mnOrgChanges() is R2 (read-only query).
 */
@Resolver(() => MnOrgChangeObjectType)
export class MnOrgChangeResolver {
  constructor(
    private readonly service: MnOrgChangeService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnOrgChangeObjectType], {
    description:
      'List structural-change proposals for an org-changes inbox. ' +
      'Workspace-scoped; filterable by project, status, type, and ' +
      'proposing agent.',
  })
  async mnOrgChanges(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('filter', { type: () => ListMnOrgChangesInput, nullable: true })
    filter?: ListMnOrgChangesInput | null
  ): Promise<MnOrgChangeObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.list(workspaceId, {
      projectId: filter?.projectId ?? null,
      statuses: filter?.statuses ?? null,
      types: filter?.types ?? null,
      proposedByAgentId: filter?.proposedByAgentId ?? null,
      limit: filter?.limit ?? null,
    }) as Promise<MnOrgChangeObjectType[]>;
  }

  @Mutation(() => MnOrgChangeObjectType, {
    description:
      'Propose a structural change. Creates a PROPOSED MnOrgChange ' +
      'row AND a sibling PENDING MnApproval (type=AGENT_ORG_CHANGE) ' +
      'linked via payload.orgChangeId so the existing inbox / SSE ' +
      'surface gates the human decision.',
  })
  async proposeMnOrgChange(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => ProposeMnOrgChangeInput })
    input: ProposeMnOrgChangeInput
  ): Promise<MnOrgChangeObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.propose(
      workspaceId,
      input
    ) as Promise<MnOrgChangeObjectType>;
  }

  @Mutation(() => MnOrgChangeObjectType, {
    description:
      'Decide a PROPOSED change (APPROVED or REJECTED). Mirrors the ' +
      'decision onto the sibling MnApproval row.',
  })
  async decideMnOrgChange(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('orgChangeId', { type: () => ID }) orgChangeId: string,
    @Args('input', { type: () => DecideMnOrgChangeInput })
    input: DecideMnOrgChangeInput
  ): Promise<MnOrgChangeObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.decide(
      workspaceId,
      orgChangeId,
      user.id,
      input
    ) as Promise<MnOrgChangeObjectType>;
  }

  @Mutation(() => MnOrgChangeObjectType, {
    description:
      'Execute an APPROVED change. Mutates the underlying tables ' +
      '(e.g. updates MnAgent.reportsToAgentId for DELEGATION_CHANGE, ' +
      'creates an MnRoutine row for NEW_ROUTINE) and transitions to ' +
      'APPLIED. Captures priorState onto the payload so revert() can ' +
      'undo if needed.',
  })
  async applyMnOrgChange(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('orgChangeId', { type: () => ID }) orgChangeId: string
  ): Promise<MnOrgChangeObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.apply(
      workspaceId,
      orgChangeId
    ) as Promise<MnOrgChangeObjectType>;
  }

  @Mutation(() => MnOrgChangeObjectType, {
    description:
      'Reverse an APPLIED change when reversibility is possible. ' +
      'Restores underlying tables from payload.priorState; transitions ' +
      'to REVERTED.',
  })
  async revertMnOrgChange(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('orgChangeId', { type: () => ID }) orgChangeId: string
  ): Promise<MnOrgChangeObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.revert(
      workspaceId,
      orgChangeId
    ) as Promise<MnOrgChangeObjectType>;
  }
}
