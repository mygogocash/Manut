import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnWorkQueueInput,
  MnWorkQueueIntakeObjectType,
  MnWorkQueueObjectType,
  UpdateMnWorkQueueInput,
} from './manut-work-queue.dto';
import { MnWorkQueueService } from './manut-work-queue.service';

/**
 * M14 — GraphQL surface for work queues. CRUD + token rotation +
 * archive. Intake history is exposed read-only here; the actual
 * intake submission is the public HTTP controller.
 *
 * Permission model:
 *   - Queries (`mnWorkQueues`, `mnWorkQueueIntakes`) require
 *     `Workspace.Read` so any workspace member can see what's in
 *     flight.
 *   - Mutations (create / update / rotate / archive) require
 *     `Workspace.Settings.Update` — token rotation in particular MUST
 *     be admin-gated because rotating revokes any pre-existing
 *     webhook senders.
 */
@Resolver()
export class MnWorkQueueResolver {
  constructor(
    private readonly svc: MnWorkQueueService,
    private readonly ac: AccessController
  ) {}

  private toObjectType(row: {
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    description: string | null;
    intakeWebhookToken: string;
    routingRules: unknown;
    defaultAssigneeAgentId: string | null;
    defaultPriority: MnWorkQueueObjectType['defaultPriority'];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): MnWorkQueueObjectType {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      intakeWebhookToken: row.intakeWebhookToken,
      routingRulesJson:
        typeof row.routingRules === 'string'
          ? row.routingRules
          : JSON.stringify(row.routingRules ?? []),
      defaultAssigneeAgentId: row.defaultAssigneeAgentId,
      defaultPriority: row.defaultPriority,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toIntakeObjectType(row: {
    id: string;
    queueId: string;
    externalRef: string | null;
    payload: unknown;
    status: MnWorkQueueIntakeObjectType['status'];
    routedToTaskId: string | null;
    receivedAt: Date;
  }): MnWorkQueueIntakeObjectType {
    return {
      id: row.id,
      queueId: row.queueId,
      externalRef: row.externalRef,
      payloadJson:
        typeof row.payload === 'string'
          ? row.payload
          : JSON.stringify(row.payload ?? null),
      status: row.status,
      routedToTaskId: row.routedToTaskId,
      receivedAt: row.receivedAt,
    };
  }

  @Query(() => [MnWorkQueueObjectType])
  async mnWorkQueues(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string
  ): Promise<MnWorkQueueObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const rows = await this.svc.listForWorkspace(workspaceId);
    return rows.map(r => this.toObjectType(r));
  }

  @Query(() => [MnWorkQueueIntakeObjectType])
  async mnWorkQueueIntakes(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('queueId', { type: () => ID }) queueId: string
  ): Promise<MnWorkQueueIntakeObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const rows = await this.svc.listIntakes(workspaceId, queueId);
    return rows.map(r => this.toIntakeObjectType(r));
  }

  @Mutation(() => MnWorkQueueObjectType)
  async createMnWorkQueue(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => CreateMnWorkQueueInput })
    input: CreateMnWorkQueueInput
  ): Promise<MnWorkQueueObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.svc.create(workspaceId, {
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      routingRulesJson: input.routingRulesJson,
      defaultAssigneeAgentId: input.defaultAssigneeAgentId,
      defaultPriority: input.defaultPriority,
    });
    return this.toObjectType(row);
  }

  @Mutation(() => MnWorkQueueObjectType)
  async updateMnWorkQueue(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('queueId', { type: () => ID }) queueId: string,
    @Args('input', { type: () => UpdateMnWorkQueueInput })
    input: UpdateMnWorkQueueInput
  ): Promise<MnWorkQueueObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.svc.update(workspaceId, queueId, input);
    return this.toObjectType(row);
  }

  @Mutation(() => MnWorkQueueObjectType)
  async rotateMnWorkQueueToken(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('queueId', { type: () => ID }) queueId: string
  ): Promise<MnWorkQueueObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.svc.rotateToken(workspaceId, queueId);
    return this.toObjectType(row);
  }

  @Mutation(() => MnWorkQueueObjectType)
  async archiveMnWorkQueue(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('queueId', { type: () => ID }) queueId: string
  ): Promise<MnWorkQueueObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.svc.archive(workspaceId, queueId);
    return this.toObjectType(row);
  }
}
