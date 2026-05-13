import { randomUUID } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type MnCrmDeal, PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnCrmAccountInput,
  CreateMnCrmActivityInput,
  CreateMnCrmContactInput,
  CreateMnCrmDealInput,
  CreateMnCrmDealStageInput,
  MnCrmAccountObjectType,
  MnCrmActivityObjectType,
  MnCrmContactObjectType,
  MnCrmDealObjectType,
  MnCrmDealStageObjectType,
  UpdateMnCrmAccountInput,
  UpdateMnCrmActivityInput,
  UpdateMnCrmContactInput,
  UpdateMnCrmDealInput,
  UpdateMnCrmDealStageInput,
} from './superflow-crm.dto';

function mapDeal(row: MnCrmDeal): MnCrmDealObjectType {
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
      const row = await this.db.mnCrmAccount.findUnique({
        where: { id: input.accountId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('accountId is not in this workspace');
      }
    }
    if (input.contactId) {
      const row = await this.db.mnCrmContact.findUnique({
        where: { id: input.contactId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('contactId is not in this workspace');
      }
    }
    if (input.dealId) {
      const row = await this.db.mnCrmDeal.findUnique({
        where: { id: input.dealId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('dealId is not in this workspace');
      }
    }
    if (input.stageId) {
      const row = await this.db.mnCrmDealStage.findUnique({
        where: { id: input.stageId },
      });
      if (!row || row.workspaceId !== workspaceId) {
        throw new BadRequestException('stageId is not in this workspace');
      }
    }
  }

  @Query(() => [MnCrmAccountObjectType])
  async mnCrmAccounts(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnCrmAccountObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.mnCrmAccount.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  @Query(() => [MnCrmContactObjectType])
  async mnCrmContacts(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnCrmContactObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.mnCrmContact.findMany({
      where: { workspaceId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  @Query(() => [MnCrmDealStageObjectType])
  async mnCrmDealStages(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnCrmDealStageObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.mnCrmDealStage.findMany({
      where: { workspaceId },
      orderBy: [{ pipelineKey: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  @Query(() => [MnCrmDealObjectType])
  async mnCrmDeals(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnCrmDealObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const rows = await this.db.mnCrmDeal.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(mapDeal);
  }

  @Query(() => [MnCrmActivityObjectType])
  async mnCrmActivities(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MnCrmActivityObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.db.mnCrmActivity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Mutation(() => MnCrmAccountObjectType)
  async createMnCrmAccount(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnCrmAccountInput })
    input: CreateMnCrmAccountInput
  ): Promise<MnCrmAccountObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.assertWorkspaceMember(workspaceId, input.ownerUserId);

    return this.db.mnCrmAccount.create({
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

  @Mutation(() => MnCrmAccountObjectType)
  async updateMnCrmAccount(
    @CurrentUser() user: CurrentUser,
    @Args('accountId', { type: () => ID }) accountId: string,
    @Args('input', { type: () => UpdateMnCrmAccountInput })
    input: UpdateMnCrmAccountInput
  ): Promise<MnCrmAccountObjectType> {
    const row = await this.db.mnCrmAccount.findUnique({
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

    return this.db.mnCrmAccount.update({
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

  @Mutation(() => MnCrmContactObjectType)
  async createMnCrmContact(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnCrmContactInput })
    input: CreateMnCrmContactInput
  ): Promise<MnCrmContactObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.assertWorkspaceFk(workspaceId, {
      accountId: input.accountId,
    });
    await this.assertWorkspaceMember(workspaceId, input.ownerUserId);

    return this.db.mnCrmContact.create({
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

  @Mutation(() => MnCrmContactObjectType)
  async updateMnCrmContact(
    @CurrentUser() user: CurrentUser,
    @Args('contactId', { type: () => ID }) contactId: string,
    @Args('input', { type: () => UpdateMnCrmContactInput })
    input: UpdateMnCrmContactInput
  ): Promise<MnCrmContactObjectType> {
    const row = await this.db.mnCrmContact.findUnique({
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

    return this.db.mnCrmContact.update({
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

  @Mutation(() => MnCrmDealStageObjectType)
  async createMnCrmDealStage(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnCrmDealStageInput })
    input: CreateMnCrmDealStageInput
  ): Promise<MnCrmDealStageObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.mnCrmDealStage.create({
      data: {
        id: randomUUID(),
        workspaceId,
        pipelineKey: input.pipelineKey ?? 'default',
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  @Mutation(() => MnCrmDealStageObjectType)
  async updateMnCrmDealStage(
    @CurrentUser() user: CurrentUser,
    @Args('stageId', { type: () => ID }) stageId: string,
    @Args('input', { type: () => UpdateMnCrmDealStageInput })
    input: UpdateMnCrmDealStageInput
  ): Promise<MnCrmDealStageObjectType> {
    const row = await this.db.mnCrmDealStage.findUnique({
      where: { id: stageId },
    });
    if (!row) {
      throw new NotFoundException('Deal stage not found');
    }
    await this.ac
      .user(user.id)
      .workspace(row.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.mnCrmDealStage.update({
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

  @Mutation(() => MnCrmDealObjectType)
  async createMnCrmDeal(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnCrmDealInput })
    input: CreateMnCrmDealInput
  ): Promise<MnCrmDealObjectType> {
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

    const created = await this.db.mnCrmDeal.create({
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

  @Mutation(() => MnCrmDealObjectType)
  async updateMnCrmDeal(
    @CurrentUser() user: CurrentUser,
    @Args('dealId', { type: () => ID }) dealId: string,
    @Args('input', { type: () => UpdateMnCrmDealInput })
    input: UpdateMnCrmDealInput
  ): Promise<MnCrmDealObjectType> {
    const row = await this.db.mnCrmDeal.findUnique({ where: { id: dealId } });
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

    const updated = await this.db.mnCrmDeal.update({
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

  @Mutation(() => MnCrmActivityObjectType)
  async createMnCrmActivity(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => CreateMnCrmActivityInput })
    input: CreateMnCrmActivityInput
  ): Promise<MnCrmActivityObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.assertWorkspaceFk(workspaceId, {
      accountId: input.accountId,
      contactId: input.contactId,
      dealId: input.dealId,
    });

    return this.db.mnCrmActivity.create({
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

  @Mutation(() => MnCrmActivityObjectType)
  async updateMnCrmActivity(
    @CurrentUser() user: CurrentUser,
    @Args('activityId', { type: () => ID }) activityId: string,
    @Args('input', { type: () => UpdateMnCrmActivityInput })
    input: UpdateMnCrmActivityInput
  ): Promise<MnCrmActivityObjectType> {
    const row = await this.db.mnCrmActivity.findUnique({
      where: { id: activityId },
    });
    if (!row) {
      throw new NotFoundException('Activity not found');
    }
    await this.ac
      .user(user.id)
      .workspace(row.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.db.mnCrmActivity.update({
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
