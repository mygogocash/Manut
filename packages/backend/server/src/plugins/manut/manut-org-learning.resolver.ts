import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  MnLearningCandidateObjectType,
  MnLearningCandidateStatus,
} from './manut-org-learning.dto';
import {
  MnOrgLearningService,
  type ParsedCandidate,
} from './manut-org-learning.service';

/**
 * GraphQL surface for M16 — Automatic Organizational Learning.
 *
 * Listing + read paths gate on `Workspace.Read`. Approve / reject /
 * extract operations gate on `Workspace.Settings.Update` because they
 * change which playbooks the org will see on the skills surface.
 *
 * Every nullable @Field on the DTO uses explicit `() => Type` form
 * (CLAUDE.md §6 v1.7.0 / v1.10.2 scar). `AccessController` is a
 * RUNTIME import so NestJS DI can resolve it via `design:paramtypes`
 * (CLAUDE.md §6 v1.12.0 scar).
 */
@Resolver(() => MnLearningCandidateObjectType)
export class MnOrgLearningResolver {
  constructor(
    private readonly service: MnOrgLearningService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnLearningCandidateObjectType], {
    description:
      'List auto-learning playbook candidates for a workspace. By default ' +
      'returns only candidates awaiting review (status=PENDING). Pass an ' +
      'explicit status to see approved or rejected history.',
  })
  async mnLearningCandidates(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('status', {
      type: () => MnLearningCandidateStatus,
      nullable: true,
      description:
        'Optional status filter. When omitted, defaults to PENDING so ' +
        'the inbox does not surface previously-handled candidates.',
    })
    status?: MnLearningCandidateStatus | null
  ): Promise<MnLearningCandidateObjectType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    // Service defaults to PENDING when status is omitted — the
    // natural inbox semantics. Pass through whatever the caller
    // explicitly chose.
    const rows = await this.service.listLearningCandidates(workspaceId, {
      status: status ?? undefined,
    });
    return rows.map(toGraphQL);
  }

  @Mutation(() => MnLearningCandidateObjectType, {
    description:
      'Approve a candidate playbook. The underlying MnSkill row remains ' +
      'source=IMPORTED so provenance (auto-extracted vs hand-authored) is ' +
      'preserved forever. Returns the updated candidate.',
  })
  async approveMnLearningCandidate(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('candidateId', { type: () => ID }) candidateId: string
  ): Promise<MnLearningCandidateObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.service.approveLearningCandidate(
      workspaceId,
      candidateId
    );
    return rowToGraphQL(row, MnLearningCandidateStatus.APPROVED);
  }

  @Mutation(() => MnLearningCandidateObjectType, {
    description:
      'Reject a candidate playbook. Archives the row AND rewrites the ' +
      'embedded marker to status=rejected so the audit trail survives.',
  })
  async rejectMnLearningCandidate(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('candidateId', { type: () => ID }) candidateId: string
  ): Promise<MnLearningCandidateObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.service.rejectLearningCandidate(
      workspaceId,
      candidateId
    );
    return rowToGraphQL(row, MnLearningCandidateStatus.REJECTED);
  }

  @Mutation(() => MnLearningCandidateObjectType, {
    description:
      'On-demand trigger: extract a candidate playbook from the given task. ' +
      'In M16.1 this is the only way to start an extraction — the ' +
      'auto-on-DONE wiring is deferred to a follow-up so MnTask service ' +
      'stays untouched.',
  })
  async triggerLearningExtractionForTask(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('taskId', { type: () => ID }) taskId: string
  ): Promise<MnLearningCandidateObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.service.extractPlaybookFromTask(taskId, workspaceId);
    return rowToGraphQL(row, MnLearningCandidateStatus.PENDING);
  }
}

function toGraphQL(parsed: ParsedCandidate): MnLearningCandidateObjectType {
  return {
    id: parsed.id,
    workspaceId: parsed.workspaceId,
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    body: parsed.body,
    sourceTaskId: parsed.sourceTaskId,
    status: parsed.status,
    source: parsed.source,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}

function rowToGraphQL(
  row: {
    id: string;
    workspaceId: string;
    slug: string;
    name: string;
    description: string | null;
    contentMd: string;
    source: any;
    createdAt: Date;
    updatedAt: Date;
  },
  status: MnLearningCandidateStatus
): MnLearningCandidateObjectType {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    body: row.contentMd,
    sourceTaskId: extractSourceTaskId(row.contentMd),
    status,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const MARKER_PREFIX = '<!-- mn-learning-candidate: ';
const MARKER_SUFFIX = ' -->';

function extractSourceTaskId(contentMd: string): string | null {
  const idx = contentMd.lastIndexOf(MARKER_PREFIX);
  if (idx < 0) return null;
  const start = idx + MARKER_PREFIX.length;
  const end = contentMd.indexOf(MARKER_SUFFIX, start);
  if (end < 0) return null;
  try {
    const obj = JSON.parse(contentMd.slice(start, end).trim()) as {
      sourceTaskId?: unknown;
    };
    return typeof obj.sourceTaskId === 'string' ? obj.sourceTaskId : null;
  } catch {
    return null;
  }
}
