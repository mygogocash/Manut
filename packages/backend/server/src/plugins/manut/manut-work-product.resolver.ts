import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnWorkProductInput,
  MnWorkProductObjectType,
} from './manut-work-product.dto';
import { MnWorkProductService } from './manut-work-product.service';

/**
 * GraphQL surface for Manut Work Products (M10).
 *
 * Permission model:
 *   - `mnWorkProducts(taskId)` — Workspace.Read. List the artifacts
 *     a task has produced. Public to all workspace members.
 *   - `createMnWorkProduct` — Workspace.Settings.Update. Producing a
 *     registry row is a write — gated like other write surfaces.
 *   - `deleteMnWorkProduct` — Workspace.Settings.Update. Same gate.
 *
 * Every nullable @Field on the DTOs uses the explicit `() => Type`
 * form (CLAUDE.md §6 UndefinedTypeError trap). Permission checks
 * happen via `AccessController` BEFORE the service call so the
 * service can stay focused on data invariants.
 *
 * `@Injectable()` is implicit on `@Resolver()` — the resolver class is
 * still a NestJS provider and emits `design:paramtypes` metadata for
 * `MnWorkProductService` + `AccessController` (v1.12.0 DI scar
 * applies to all providers, not just plain services).
 */
@Resolver(() => MnWorkProductObjectType)
export class MnWorkProductResolver {
  constructor(
    private readonly service: MnWorkProductService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnWorkProductObjectType], {
    description:
      'List work products attributed to a task, newest first. ' +
      'Workspace-fenced — passing a task from another workspace returns [].',
  })
  async mnWorkProducts(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('taskId', { type: () => ID }) taskId: string
  ): Promise<MnWorkProductObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.listByTask(workspaceId, taskId) as Promise<
      MnWorkProductObjectType[]
    >;
  }

  @Query(() => MnWorkProductObjectType, {
    nullable: true,
    description:
      'Fetch a single work product by id. Returns null when the row ' +
      'does not exist or belongs to another workspace.',
  })
  async mnWorkProduct(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('workProductId', { type: () => ID }) workProductId: string
  ): Promise<MnWorkProductObjectType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.service.get(
      workspaceId,
      workProductId
    ) as Promise<MnWorkProductObjectType | null>;
  }

  @Mutation(() => MnWorkProductObjectType, {
    description:
      'Create a new work product attached to a task. Requires ' +
      'Workspace.Settings.Update. The task and (optional) producer agent ' +
      'must live in the same workspace as the caller — cross-workspace ' +
      'attachment is rejected with Forbidden.',
  })
  async createMnWorkProduct(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input', { type: () => CreateMnWorkProductInput })
    input: CreateMnWorkProductInput
  ): Promise<MnWorkProductObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.service.create(
      workspaceId,
      input
    ) as Promise<MnWorkProductObjectType>;
  }

  @Mutation(() => Boolean, {
    description:
      'Delete a work product registry row. Does NOT delete the underlying ' +
      'artifact (doc / PR / file) — those are owned by their source-of- ' +
      'truth system. Requires Workspace.Settings.Update.',
  })
  async deleteMnWorkProduct(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('workProductId', { type: () => ID }) workProductId: string
  ): Promise<boolean> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    await this.service.delete(workspaceId, workProductId);
    return true;
  }
}
