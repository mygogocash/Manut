import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { UserType } from '../../core/user';
import { WorkspaceType } from '../../core/workspaces';
import { Models } from '../../models';
import { AggregateBucket } from './providers';
import { IndexerService, SearchNodeWithMeta } from './service';
import {
  AggregateInput,
  AggregateResultObjectType,
  SearchDocObjectType,
  SearchDocsInput,
  SearchInput,
  SearchQueryOccur,
  SearchQueryType,
  SearchResultObjectType,
} from './types';

/** Extra score added to verified pages in search results. */
const VERIFIED_PAGES_SCORE_BOOST = 1.0;

@Resolver(() => WorkspaceType)
export class IndexerResolver {
  constructor(
    private readonly indexer: IndexerService,
    private readonly ac: AccessController,
    private readonly models: Models
  ) {}

  @ResolveField(() => SearchResultObjectType, {
    description: 'Search a specific table',
  })
  async search(
    @CurrentUser() me: UserType,
    @Parent() workspace: WorkspaceType,
    @Args('input') input: SearchInput
  ): Promise<SearchResultObjectType> {
    // currentUser can read the workspace
    await this.ac.user(me.id).workspace(workspace.id).assert('Workspace.Read');
    this.#addWorkspaceFilter(workspace, input);

    const result = await this.indexer.search(input);
    const nodes = await this.#filterUserReadableDocs(
      workspace,
      me,
      result.nodes
    );

    // Apply a score boost for verified pages and re-sort.
    const boostedNodes = await this.#boostVerifiedNodes(workspace.id, nodes);

    return {
      nodes: boostedNodes,
      pagination: {
        count: result.total,
        hasMore: nodes.length > 0,
        nextCursor: result.nextCursor,
      },
    };
  }

  @ResolveField(() => AggregateResultObjectType, {
    description: 'Search a specific table with aggregate',
  })
  async aggregate(
    @CurrentUser() me: UserType,
    @Parent() workspace: WorkspaceType,
    @Args('input') input: AggregateInput
  ): Promise<AggregateResultObjectType> {
    // currentUser can read the workspace
    await this.ac.user(me.id).workspace(workspace.id).assert('Workspace.Read');
    this.#addWorkspaceFilter(workspace, input);

    const result = await this.indexer.aggregate(input);
    const needs: AggregateBucket[] = [];
    for (const bucket of result.buckets) {
      bucket.hits.nodes = await this.#filterUserReadableDocs(
        workspace,
        me,
        bucket.hits.nodes as SearchNodeWithMeta[]
      );
      if (bucket.hits.nodes.length > 0) {
        needs.push(bucket);
      }
    }
    return {
      buckets: needs,
      pagination: {
        count: result.total,
        hasMore: needs.length > 0,
        nextCursor: result.nextCursor,
      },
    };
  }

  @ResolveField(() => [SearchDocObjectType], {
    description: 'Search docs by keyword',
  })
  async searchDocs(
    @CurrentUser() me: UserType,
    @Parent() workspace: WorkspaceType,
    @Args('input') input: SearchDocsInput
  ): Promise<SearchDocObjectType[]> {
    const docs = await this.indexer.searchDocsByKeyword(
      workspace.id,
      input.keyword,
      {
        limit: input.limit,
      }
    );

    const needs = await this.ac
      .user(me.id)
      .workspace(workspace.id)
      .docs(docs, 'Doc.Read');
    return needs;
  }

  #addWorkspaceFilter(
    workspace: WorkspaceType,
    input: SearchInput | AggregateInput
  ) {
    // filter by workspace id
    input.query = {
      type: SearchQueryType.boolean,
      occur: SearchQueryOccur.must,
      queries: [
        {
          type: SearchQueryType.match,
          field: 'workspaceId',
          match: workspace.id,
        },
        input.query,
      ],
    };
  }

  /**
   * filter user readable docs on team workspace
   */
  async #filterUserReadableDocs(
    workspace: WorkspaceType,
    user: UserType,
    nodes: SearchNodeWithMeta[]
  ) {
    if (nodes.length === 0) {
      return nodes;
    }

    const isTeamWorkspace = await this.models.workspaceFeature.has(
      workspace.id,
      'team_plan_v1'
    );
    if (!isTeamWorkspace) {
      return nodes;
    }

    const needs = await this.ac
      .user(user.id)
      .workspace(workspace.id)
      .docs(
        nodes.map(node => ({
          node,
          docId: node._source.docId,
        })),
        'Doc.Read'
      );
    return needs.map(node => node.node);
  }

  /**
   * Boost score of verified pages and re-sort descending by score.
   *
   * Fetches verification state in a single batch query to avoid N+1.
   */
  async #boostVerifiedNodes(
    workspaceId: string,
    nodes: SearchNodeWithMeta[]
  ): Promise<SearchNodeWithMeta[]> {
    if (nodes.length === 0) return nodes;

    // Collect unique docIds to check verification status.
    const docIds = [...new Set(nodes.map(n => n._source.docId))];

    const verifiedDocs = await this.models.doc.findActiveVerified({
      workspaceId,
      docIds,
    });

    if (verifiedDocs.length === 0) return nodes;

    const verifiedSet = new Set(verifiedDocs.map(d => d.docId));

    const boosted = nodes.map(node => {
      if (verifiedSet.has(node._source.docId)) {
        return { ...node, _score: node._score + VERIFIED_PAGES_SCORE_BOOST };
      }
      return node;
    });

    // Re-sort by descending score after boosting.
    boosted.sort((a, b) => b._score - a._score);
    return boosted;
  }
}
