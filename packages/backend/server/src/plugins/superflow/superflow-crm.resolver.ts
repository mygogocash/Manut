import { randomUUID } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient, type SfCrmDeal } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateSfCrmAccountInput,
  CreateSfCrmActivityInput,
  CreateSfCrmContactInput,
  CreateSfCrmDealInput,
  CreateSfCrmDealStageInput,
  SfCrmAccountObjectType,
  SfCrmActivityObjectType,
  SfCrmContactObjectType,
  SfCrmDealObjectType,
  SfCrmDealStageObjectType,
  UpdateSfCrmAccountInput,
  UpdateSfCrmActivityInput,
  UpdateSfCrmContactInput,
  UpdateSfCrmDealInput,
  UpdateSfCrmDealStageInput,
} from './superflow-crm.dto';

function mapDeal(row: SfCrmDeal): SfCrmDealObjectType {
  const v = row.value;
  const num =
    v === null || v === undefined
      ? null
      : typeof v === 'object' && 'toNumber' in v
        ? (v as { toNumber: () => number }).toNumber()
        : Number(v);
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    accountId: row.accountId,
    contactId: row.contactId,
    stageId: row.stageId,
    name: row.name,
    value: num !== null && Number.isFinite(num) ? num : null,
    currency: row.currency,
    probability: row.probability,
    expectedCloseAt: row.expectedCloseAt,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Resolver()
export class SuperflowCrmResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController
  ) {}

  private async assertWorkspaceMember(
    workspaceId: string,
    userId?: string | null
  ) {
    if (!userId) {
      return;
    }

    const member = await this.db.workspaceUserRole.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) {
      throw new BadRequestException('ownerUserId is not in this workspace');
    }
  }

  private async assertWorkspaceFk(
    workspaceId: string,
    input: {
      accountId?: string | null;
      contactId?: string | null;
      dealId?: string | null;
      stageId?: string | null;
    }
  ) {
    if (input.accountId) {
      const row = await this.db.sfCrmAccount.findUnique({
        where: { id: input.accountId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('accountId is not in this workspace');
      }
    }
    if (input.contactId) {
      const row = await this.db.sfCrmContact.findUnique({
        where: { id: input.contactId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('contactId is not in this workspace');
      }
    }
    if (input.dealId) {
      const row = await this.db.sfCrmDeal.findUnique({
        where: { id: input.dealId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('dealId is not in this workspace');
      }
    }
    if (input.stageId) {
      const row = await this.db.sfCrmDealStage.findUnique({
        where: { id: input.stageId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('stageId is not in this workspace');
      }
    }
  }

  @Query(() => [SfCrmAccountObjectType])
  async sfCrmAccounts(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SfCrmAccountObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.sfCrmAccount.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  @Query(() => [SfCrmContactObjectType])
  async sfCrmContacts(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SfCrmContactObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.sfCrmContact.findMany({
      where: { workspaceId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  @Query(() => [SfCrmDealStageObjectType])
  async sfCrmDealStages(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SfCrmDealStageObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.sfCrmDealStage.findMany({
      where: { workspaceId },
      orderBy: [{ pipelineKey: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  @Query(() => [SfCrmDealObjectType])
  async sfCrmDeals(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SfCrmDealObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const rows = await this.db.sfCrmDeal.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(mapDeal);
  }

  @Query(() => [SfCrmActivityObjectType])
  async sfCrmActivities(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SfCrmActivityObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.sfCrmActivity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Mutation(() => SfCrmAccountObjectType)
  async createSfCrmAccount(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateSfCrmAccountInput })
    input: CreateSfCrmAccountInput
  ): Promise<SfCrmAccountObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.assertWorkspaceMember(workspaceId, input.ownerUserId);

    return this.db.sfCrmAccount.create({
      data: {
        id: randomUUID(),
        workspaceId,
        name: input.name,
        website: input.website ?? null,
        industry: input.industry ?? null,
        notes: input.notes ?? null,
        ownerUserId: input.ownerUserId ?? null,
      },
    });
  }

  @Mutation(() => SfCrmAccountObjectType)
  async updateSfCrmAccount(
    @CurrentUser() user: CurrentUser,
    @Args('accountId', { type: () => ID }) accountId: string,
    @Args('input', { type: () => UpdateSfCrmAccountInput })
    input: UpdateSfCrmAccountInput
  ): Promise<SfCrmAccountObjectType> {
    const row = await this.db.sfCrmAccount.findUnique({
      where: { id: accountId },
    });
    if (!row) {
      throw new NotFoundException('Account not found');
    }
    await this.ac
      .user(user.id)
      .workspace(row.workspaceId)
      .assert('Workspace.Settings.Update');
    await this.assertWorkspaceMember(row.workspaceId, input.ownerUserId);

    return this.db.sfCrmAccount.update({
      where: { id: accountId },
      data: {
        ...(input.name !== undefined && input.name !== null
          ? { name: input.name }
          : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.industry !== undefined ? { industry: input.industry } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.ownerUserId !== undefined
          ? { ownerUserId: input.ownerUserId }
          : {}),
      },
    });
  }

  @Mutation(() => SfCrmContactObjectType)
  async createSfCrmContact(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateSfCrmContactInput })
    input: CreateSfCrmContactInput
  ): Promise<SfCrmContactObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.assertWorkspaceFk(workspaceId, {
      accountId: input.accountId,
    });
    await this.assertWorkspaceMember(workspaceId, input.ownerUserId);

    return this.db.sfCrmContact.create({
      data: {
        id: randomUUID(),
        workspaceId,
        accountId: input.accountId ?? null,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        title: input.title ?? null,
        ownerUserId: input.ownerUserId ?? null,
      },
    });
  }

  @Mutation(() => SfCrmContactObjectType)
  async updateSfCrmContact(
    @CurrentUser() user: CurrentUser,
    @Args('contactId', { type: () => ID }) contactId: string,
    @Args('input', { type: () => UpdateSfCrmContactInput })
    input: UpdateSfCrmContactInput
  ): Promise<SfCrmContactObjectType> {
    const row = await this.db.sfCrmContact.findUnique({
      where: { id: contactId },
    });
    if (!row) {
      throw new NotFoundException('Contact not found');
    }
    await this.ac
      .user(user.id)
      .workspace(row.workspaceId)
      .assert('Workspace.Settings.Update');

    if (input.accountId !== undefined && input.accountId !== null) {
      await this.assertWorkspaceFk(row.workspaceId, {
        accountId: input.accountId,
      });
    }
    await this.assertWorkspaceMember(row.workspaceId, input.ownerUserId);

    return this.db.sfCrmContact.update({
      where: { id: contactId },
      data: {
        ...(input.accountId !== undefined
          ? { accountId: input.accountId }
          : {}),
        ...(input.firstName !== undefined && input.firstName !== null
          ? { firstName: input.firstName }
          : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.ownerUserId !== undefined
          ? { ownerUserId: input.ownerUserId }
          : {}),
      },
    });
  }

  @Mutation(() => SfCrmDealStageObjectType)
  async createSfCrmDealStage(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateSfCrmDealStageInput })
    input: CreateSfCrmDealStageInput
  ): Promise<SfCrmDealStageObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.sfCrmDealStage.create({
      data: {
        id: randomUUID(),
        workspaceId,
        pipelineKey: input.pipelineKey ?? 'default',
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  @Mutation(() => SfCrmDealStageObjectType)
  async updateSfCrmDealStage(
    @CurrentUser() user: CurrentUser,
    @Args('stageId', { type: () => ID }) stageId: string,
    @Args('input', { type: () => UpdateSfCrmDealStageInput })
    input: UpdateSfCrmDealStageInput
  ): Promise<SfCrmDealStageObjectType> {
    const row = await this.db.sfCrmDealStage.findUnique({
      where: { id: stageId },
    });
    if (!row) {
      throw new NotFoundException('Deal stage not found');
    }
    await this.ac
      .user(user.id)
      .workspace(row.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.sfCrmDealStage.update({
      where: { id: stageId },
      data: {
        ...(input.name !== undefined && input.name !== null
          ? { name: input.name }
          : {}),
        ...(input.sortOrder !== undefined && input.sortOrder !== null
          ? { sortOrder: input.sortOrder }
          : {}),
      },
    });
  }

  @Mutation(() => SfCrmDealObjectType)
  async createSfCrmDeal(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateSfCrmDealInput })
    input: CreateSfCrmDealInput
  ): Promise<SfCrmDealObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.assertWorkspaceFk(workspaceId, {
      accountId: input.accountId,
      contactId: input.contactId,
      stageId: input.stageId,
    });
    await this.assertWorkspaceMember(workspaceId, input.ownerUserId);

    const created = await this.db.sfCrmDeal.create({
      data: {
        id: randomUUID(),
        workspaceId,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        stageId: input.stageId,
        name: input.name,
        value: input.value ?? null,
        currency: input.currency ?? 'USD',
        probability: input.probability ?? null,
        expectedCloseAt: input.expectedCloseAt ?? null,
        ownerUserId: input.ownerUserId ?? null,
      },
    });
    return mapDeal(created);
  }

  @Mutation(() => SfCrmDealObjectType)
  async updateSfCrmDeal(
    @CurrentUser() user: CurrentUser,
    @Args('dealId', { type: () => ID }) dealId: string,
    @Args('input', { type: () => UpdateSfCrmDealInput })
    input: UpdateSfCrmDealInput
  ): Promise<SfCrmDealObjectType> {
    const row = await this.db.sfCrmDeal.findUnique({ where: { id: dealId } });
    if (!row) {
      throw new NotFoundException('Deal not found');
    }
    await this.ac
      .user(user.id)
      .workspace(row.workspaceId)
      .assert('Workspace.Settings.Update');

    await this.assertWorkspaceFk(row.workspaceId, {
      accountId: input.accountId,
      contactId: input.contactId,
      stageId: input.stageId,
    });
    await this.assertWorkspaceMember(row.workspaceId, input.ownerUserId);

    const updated = await this.db.sfCrmDeal.update({
      where: { id: dealId },
      data: {
        ...(input.accountId !== undefined
          ? { accountId: input.accountId }
          : {}),
        ...(input.contactId !== undefined
          ? { contactId: input.contactId }
          : {}),
        ...(input.stageId !== undefined && input.stageId !== null
          ? { stageId: input.stageId }
          : {}),
        ...(input.name !== undefined && input.name !== null
          ? { name: input.name }
          : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.probability !== undefined
          ? { probability: input.probability }
          : {}),
        ...(input.expectedCloseAt !== undefined
          ? { expectedCloseAt: input.expectedCloseAt }
          : {}),
        ...(input.ownerUserId !== undefined
          ? { ownerUserId: input.ownerUserId }
          : {}),
      },
    });
    return mapDeal(updated);
  }

  @Mutation(() => SfCrmActivityObjectType)
  async createSfCrmActivity(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateSfCrmActivityInput })
    input: CreateSfCrmActivityInput
  ): Promise<SfCrmActivityObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.assertWorkspaceFk(workspaceId, {
      accountId: input.accountId,
      contactId: input.contactId,
      dealId: input.dealId,
    });

    return this.db.sfCrmActivity.create({
      data: {
        id: randomUUID(),
        workspaceId,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        type: input.type,
        subject: input.subject ?? null,
        body: input.body ?? null,
        dueAt: input.dueAt ?? null,
        createdByUserId: user.id,
      },
    });
  }

  @Mutation(() => SfCrmActivityObjectType)
  async updateSfCrmActivity(
    @CurrentUser() user: CurrentUser,
    @Args('activityId', { type: () => ID }) activityId: string,
    @Args('input', { type: () => UpdateSfCrmActivityInput })
    input: UpdateSfCrmActivityInput
  ): Promise<SfCrmActivityObjectType> {
    const row = await this.db.sfCrmActivity.findUnique({
      where: { id: activityId },
    });
    if (!row) {
      throw new NotFoundException('Activity not found');
    }
    await this.ac
      .user(user.id)
      .workspace(row.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.sfCrmActivity.update({
      where: { id: activityId },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        ...(input.completedAt !== undefined
          ? { completedAt: input.completedAt }
          : {}),
      },
    });
  }
}
