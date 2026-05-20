import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import type { FileUpload } from '../../../base';
import {
  AFFiNELogger,
  registerObjectType,
  SpaceAccessDenied,
  SpaceNotFound,
} from '../../../base';
import { Models } from '../../../models';
import { CurrentUser } from '../../auth';
import {
  AccessController,
  WORKSPACE_ACTIONS,
  WorkspaceAction,
  WorkspaceRole,
} from '../../permission';
import { QuotaService, WorkspaceQuotaType } from '../../quota';
import {
  type WizardAnswers,
  type WizardApp,
  type WizardContext,
  type WizardTeam,
  WorkspaceService,
} from '../service';
import {
  UpdateWorkspaceInput,
  WizardAnswersInput,
  WorkspaceType,
} from '../types';

const ALLOWED_WIZARD_CONTEXTS: ReadonlyArray<WizardContext> = [
  'saas',
  'agency',
  'personal',
  'research',
  'other',
];
const ALLOWED_WIZARD_TEAMS: ReadonlyArray<WizardTeam> = [
  'solo',
  '2-5',
  '6-20',
  '20+',
];
const ALLOWED_WIZARD_APPS: ReadonlyArray<WizardApp> = [
  'gmail',
  'calendar',
  'github',
];

/**
 * Wave 2 B6 — narrow the loose GraphQL `WizardAnswersInput` shape into
 * the strict `WizardAnswers` type that `seedStarterDoc` expects. Every
 * unknown / empty / malformed field is dropped silently; if the entire
 * input is empty we return `undefined` so the seed path takes the
 * legacy no-answers branch.
 */
function sanitizeWizardAnswers(
  input?: WizardAnswersInput | null
): WizardAnswers | undefined {
  if (!input) return undefined;

  const out: WizardAnswers = {};

  if (
    typeof input.context === 'string' &&
    (ALLOWED_WIZARD_CONTEXTS as readonly string[]).includes(input.context)
  ) {
    out.context = input.context as WizardContext;
  }

  if (
    typeof input.team === 'string' &&
    (ALLOWED_WIZARD_TEAMS as readonly string[]).includes(input.team)
  ) {
    out.team = input.team as WizardTeam;
  }

  if (Array.isArray(input.apps)) {
    const apps: WizardApp[] = [];
    for (const candidate of input.apps) {
      if (
        typeof candidate === 'string' &&
        (ALLOWED_WIZARD_APPS as readonly string[]).includes(candidate) &&
        !apps.includes(candidate as WizardApp)
      ) {
        apps.push(candidate as WizardApp);
      }
    }
    if (apps.length > 0) out.apps = apps;
  }

  if (typeof input.project === 'string') {
    const trimmed = input.project.trim().slice(0, 200);
    if (trimmed.length > 0) {
      out.project = trimmed;
    }
  }

  return Object.keys(out).length === 0 ? undefined : out;
}

export type DotToUnderline<T extends string> =
  T extends `${infer Prefix}.${infer Suffix}`
    ? `${Prefix}_${DotToUnderline<Suffix>}`
    : T;

export function mapPermissionsToGraphqlPermissions<A extends string>(
  permission: Record<A, boolean>
): Record<DotToUnderline<A>, boolean> {
  return Object.fromEntries(
    Object.entries(permission).map(([key, value]) => [
      key.replaceAll('.', '_'),
      value,
    ])
  ) as Record<DotToUnderline<A>, boolean>;
}

const WorkspacePermissions = registerObjectType<
  Record<DotToUnderline<WorkspaceAction>, boolean>
>(
  Object.fromEntries(
    WORKSPACE_ACTIONS.map(action => [
      action.replaceAll('.', '_'),
      {
        type: () => Boolean,
        options: {
          name: action.replaceAll('.', '_'),
        },
      },
    ])
  ),
  { name: 'WorkspacePermissions' }
);

@ObjectType()
export class WorkspaceRolePermissions {
  @Field(() => WorkspaceRole)
  role!: WorkspaceRole;

  @Field(() => WorkspacePermissions)
  permissions!: Record<DotToUnderline<WorkspaceAction>, boolean>;
}

/**
 * Workspace resolver
 * Public apis rate limit: 10 req/m
 * Other rate limit: 120 req/m
 */
@Resolver(() => WorkspaceType)
export class WorkspaceResolver {
  constructor(
    private readonly ac: AccessController,
    private readonly quota: QuotaService,
    private readonly models: Models,
    private readonly workspaceService: WorkspaceService,
    private readonly logger: AFFiNELogger
  ) {
    logger.setContext(WorkspaceResolver.name);
  }

  @ResolveField(() => Boolean, {
    description: 'is current workspace initialized',
    complexity: 2,
  })
  async initialized(@Parent() workspace: WorkspaceType) {
    return this.models.doc.exists(workspace.id, workspace.id);
  }

  @ResolveField(() => Boolean, {
    name: 'team',
    description: 'if workspace is team workspace',
    complexity: 2,
  })
  team(@Parent() workspace: WorkspaceType) {
    return this.workspaceService.isTeamWorkspace(workspace.id);
  }

  @ResolveField(() => WorkspaceRole, {
    description: 'Role of current signed in user in workspace',
    complexity: 2,
  })
  async role(
    @CurrentUser() user: CurrentUser,
    @Parent() workspace: WorkspaceType
  ) {
    // may applied in workspaces query
    if ('role' in workspace) {
      return workspace.role;
    }

    const { role } = await this.ac
      .user(user.id)
      .workspace(workspace.id)
      .permissions();

    return role ?? WorkspaceRole.External;
  }

  @ResolveField(() => WorkspacePermissions, {
    description: 'map of action permissions',
  })
  async permissions(
    @CurrentUser() user: CurrentUser,
    @Parent() workspace: WorkspaceType
  ) {
    const { permissions } = await this.ac
      .user(user.id)
      .workspace(workspace.id)
      .permissions();

    return mapPermissionsToGraphqlPermissions(permissions);
  }

  @ResolveField(() => WorkspaceQuotaType, {
    name: 'quota',
    description: 'quota of workspace',
    complexity: 2,
  })
  async workspaceQuota(
    @Parent() workspace: WorkspaceType
  ): Promise<WorkspaceQuotaType> {
    try {
      const quota = await this.quota.getWorkspaceQuotaWithUsage(workspace.id);
      return {
        ...quota,
        humanReadable: this.quota.formatWorkspaceQuota(quota),
      };
    } catch (err) {
      // Defensive fallback: if quota lookup throws (storage backend hiccup,
      // missing migration on a freshly-cloned workspace, stale ownerQuota
      // pointing at a deleted user, etc.) we MUST still return a populated
      // WorkspaceQuotaType — every `@Field` is non-nullable so Prisma
      // returning `null` from a deep call would surface as a GraphQL
      // serialization error to the frontend ("An internal error occurred"
      // on the Members panel was traced to this path). Log the cause for
      // operators; ship the user a permissive Free-tier shape so the
      // members list and invite flow still render.
      this.logger.error(
        `workspaceQuota resolver fell back to safe defaults for workspace ${workspace.id}`,
        err
      );
      const safe: Omit<WorkspaceQuotaType, 'humanReadable'> = {
        name: 'free',
        // MANUT: 100k seat cap matches QuotaService.getWorkspaceQuota
        // self-hosted override; safe upper bound for cloud + self-host both.
        memberLimit: 100_000,
        memberCount: 0,
        overcapacityMemberCount: 0,
        blobLimit: 100 * 1024 * 1024,
        storageQuota: 2 * 1024 * 1024 * 1024,
        usedStorageQuota: 0,
        historyPeriod: 0,
        usedSize: 0,
      };
      return {
        ...safe,
        humanReadable: this.quota.formatWorkspaceQuota(safe),
      };
    }
  }

  @Query(() => [WorkspaceType], {
    description: 'Get all accessible workspaces for current user',
    complexity: 2,
  })
  async workspaces(@CurrentUser() user: CurrentUser) {
    const roles = await this.models.workspaceUser.getUserActiveRoles(user.id);

    const map = new Map(
      roles.map(({ workspaceId, type }) => [workspaceId, type])
    );

    const workspaces = await this.models.workspace.findMany(
      roles.map(({ workspaceId }) => workspaceId)
    );

    return workspaces.map(workspace => ({
      ...workspace,
      permission: map.get(workspace.id),
      role: map.get(workspace.id),
    }));
  }

  @Query(() => WorkspaceType, {
    description: 'Get workspace by id',
  })
  async workspace(@CurrentUser() user: CurrentUser, @Args('id') id: string) {
    const workspace = await this.models.workspace.getBySlugOrId(id);

    if (!workspace) {
      throw new SpaceNotFound({ spaceId: id });
    }

    await this.ac
      .user(user.id)
      .workspace(workspace.id)
      .assert('Workspace.Read');

    return workspace;
  }

  @ResolveField(() => String, {
    description: 'URL-safe workspace path segment',
    complexity: 1,
  })
  slug(@Parent() workspace: WorkspaceType & { slug?: string }) {
    return workspace.slug ?? workspace.id;
  }

  @Query(() => WorkspaceRolePermissions, {
    description: 'Get workspace role permissions',
    deprecationReason: 'use WorkspaceType[permissions] instead',
  })
  async workspaceRolePermissions(
    @CurrentUser() user: CurrentUser,
    @Args('id') id: string
  ): Promise<WorkspaceRolePermissions> {
    const { role, permissions } = await this.ac
      .user(user.id)
      .workspace(id)
      .permissions();

    if (!role) {
      throw new SpaceAccessDenied({ spaceId: id });
    }

    return {
      role,
      permissions: mapPermissionsToGraphqlPermissions(permissions),
    };
  }

  @Mutation(() => WorkspaceType, {
    description: 'Create a new workspace',
  })
  async createWorkspace(
    @CurrentUser() user: CurrentUser,
    // we no longer support init workspace with a preload file
    // use sync system to uploading them once created
    @Args({ name: 'init', type: () => GraphQLUpload, nullable: true })
    init: FileUpload | null
  ) {
    const workspace = await this.models.workspace.create(user.id);

    if (init) {
      // convert stream to buffer
      const chunks: Uint8Array[] = [];
      try {
        for await (const chunk of init.createReadStream()) {
          chunks.push(chunk);
        }
      } catch (e) {
        this.logger.error('Failed to get file content from upload stream', e);
        chunks.length = 0;
      }
      const buffer = chunks.length ? Buffer.concat(chunks) : null;

      if (buffer) {
        await this.models.doc.upsert({
          spaceId: workspace.id,
          docId: workspace.id,
          blob: buffer,
          timestamp: Date.now(),
          editorId: user.id,
        });
      }
    } else {
      // Wave 2 B5 — seed a "Getting Started" doc for brand-new
      // workspaces created from the /welcome flow. We skip this when
      // an `init` blob is provided because that path is the legacy
      // import-existing-data flow, which ships its own first doc.
      // Best-effort: a seed failure is logged inside `seedStarterDoc`
      // but never bubbles up — the workspace already exists.
      await this.workspaceService.seedStarterDoc(workspace.id, user.id);
    }

    return workspace;
  }

  /**
   * Wave 2 B6 — push the additional wizard-driven starter docs
   * (Project plan + Team notes) into a freshly-created workspace.
   *
   * Kept as its own mutation so we don't have to alter the long-stable
   * `createWorkspace` mutation signature (which is invoked from many
   * places including the cloud workspace-engine layer that has no
   * notion of the welcome wizard). The /welcome page calls
   * `createWorkspace` first, then this mutation, when the user
   * supplied wizard answers.
   *
   * Best-effort: the seed runs through `WorkspaceService.seedStarterDoc`
   * which swallows + logs failures (the workspace itself already
   * exists; an extra doc that fails to seed is non-fatal).
   *
   * Returns `true` to keep the mutation shape simple.
   */
  @Mutation(() => Boolean, {
    description:
      'Seed additional starter docs derived from the /welcome onboarding wizard answers.',
  })
  async seedWorkspaceFromWizard(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId') workspaceId: string,
    @Args('answers', { type: () => WizardAnswersInput })
    answers: WizardAnswersInput
  ): Promise<boolean> {
    // Authorisation: only the owner of the workspace can seed extras.
    // `Workspace.Settings.Update` is the closest existing permission
    // bit — it covers anyone who could legitimately reshape the
    // workspace's contents.
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const sanitized = sanitizeWizardAnswers(answers);
    if (!sanitized) {
      return true;
    }
    await this.workspaceService.seedStarterDoc(workspaceId, user.id, sanitized);
    return true;
  }

  @Mutation(() => WorkspaceType, {
    description: 'Update workspace',
  })
  async updateWorkspace(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'input', type: () => UpdateWorkspaceInput })
    { id, ...updates }: UpdateWorkspaceInput
  ) {
    await this.ac
      .user(user.id)
      .workspace(id)
      .assert('Workspace.Settings.Update');
    return this.models.workspace.update(id, updates);
  }

  @Mutation(() => Boolean)
  async deleteWorkspace(
    @CurrentUser() user: CurrentUser,
    @Args('id') id: string
  ) {
    await this.ac.user(user.id).workspace(id).assert('Workspace.Delete');

    await this.models.workspace.delete(id);

    return true;
  }
}
