import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnSkillInput,
  MnSkillObjectType,
  UpdateMnSkillInput,
} from './manut-skill.dto';
import { MnSkillService } from './manut-skill.service';

/**
 * GraphQL surface for Manut Skills (M5.1).
 *
 * Every nullable @Field on the DTOs uses the explicit `() => Type`
 * form per CLAUDE.md §6 (UndefinedTypeError trap). Permissions are
 * checked via `AccessController` BEFORE the service call so the
 * service can stay focused on data invariants.
 */
@Resolver(() => MnSkillObjectType)
export class MnSkillResolver {
  constructor(
    private readonly service: MnSkillService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnSkillObjectType], {
    description:
      'List skills in a workspace. Excludes archived rows by default; pass ' +
      'includeArchived=true to see the full history.',
  })
  async mnSkills(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('includeArchived', { type: () => Boolean, nullable: true })
    includeArchived?: boolean | null
  ): Promise<MnSkillObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.list(workspaceId, {
      includeArchived: includeArchived ?? false,
    }) as Promise<MnSkillObjectType[]>;
  }

  @Query(() => MnSkillObjectType, {
    nullable: true,
    description:
      'Fetch a single skill by id. Returns null when the skill does not ' +
      'exist or belongs to another workspace.',
  })
  async mnSkill(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('skillId', { type: () => ID }) skillId: string
  ): Promise<MnSkillObjectType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.get(
      workspaceId,
      skillId
    ) as Promise<MnSkillObjectType | null>;
  }

  @Query(() => MnSkillObjectType, {
    nullable: true,
    description: 'Look up a skill by its workspace-scoped slug.',
  })
  async mnSkillBySlug(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('slug', { type: () => String }) slug: string
  ): Promise<MnSkillObjectType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.getBySlug(
      workspaceId,
      slug
    ) as Promise<MnSkillObjectType | null>;
  }

  @Mutation(() => MnSkillObjectType, {
    description:
      'Create a new skill. Requires Workspace.Settings.Update. Slug must ' +
      'be unique within the workspace.',
  })
  async createMnSkill(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => CreateMnSkillInput })
    input: CreateMnSkillInput
  ): Promise<MnSkillObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.create(
      workspaceId,
      input
    ) as Promise<MnSkillObjectType>;
  }

  @Mutation(() => MnSkillObjectType, {
    description:
      'Patch editable fields on a skill. The version-bump rule applies: ' +
      'editing contentMd without changing version is rejected.',
  })
  async updateMnSkill(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('skillId', { type: () => ID }) skillId: string,
    @Args('input', { type: () => UpdateMnSkillInput })
    input: UpdateMnSkillInput
  ): Promise<MnSkillObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.update(
      workspaceId,
      skillId,
      input
    ) as Promise<MnSkillObjectType>;
  }

  @Mutation(() => MnSkillObjectType, {
    description:
      'Archive a skill (soft delete). Archived skills are hidden from the ' +
      'default list but preserved so existing references keep resolving.',
  })
  async archiveMnSkill(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('skillId', { type: () => ID }) skillId: string
  ): Promise<MnSkillObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.archive(
      workspaceId,
      skillId
    ) as Promise<MnSkillObjectType>;
  }

  @Mutation(() => MnSkillObjectType, {
    description:
      'Restore an archived skill so it shows in default lists again.',
  })
  async restoreMnSkill(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('skillId', { type: () => ID }) skillId: string
  ): Promise<MnSkillObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.restore(
      workspaceId,
      skillId
    ) as Promise<MnSkillObjectType>;
  }
}
