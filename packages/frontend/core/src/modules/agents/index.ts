/**
 * Agents module — workspace-scoped feature for creating per-workspace AI
 * agents with their own instructions, files, skills, links, and sub-agents.
 *
 * Public surface used by sidebar + agents list/detail pages:
 *   - `AgentService` (LiveData-driven CRUD via the workspace's GraphQL service)
 *   - `topLevelAgents$`: LiveData<AgentSummary[]>
 *   - `agent$(id)`: LiveData<AgentDetail | null>
 *   - `createAgent`, `updateAgent`, `deleteAgent`, `createSubAgent`
 *   - skill/link/file mutations
 */

import type { Framework } from '@toeverything/infra';
import { LiveData, Service } from '@toeverything/infra';

import { WorkspaceServerService } from '../cloud';
import { GraphQLService } from '../cloud/services/graphql';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import {
  addAgentFileMutation,
  addAgentLinkMutation,
  addAgentSkillMutation,
  createAgentMutation,
  deleteAgentMutation,
  getAgentQuery,
  listAgentsQuery,
  removeAgentFileMutation,
  removeAgentLinkMutation,
  removeAgentSkillMutation,
  updateAgentMutation,
} from './queries';

export interface AgentLink {
  url: string;
  label?: string | null;
}

export interface AgentDetail {
  id: string;
  workspaceId: string;
  ownerId: string;
  parentAgentId: string | null;
  name: string;
  description: string;
  instructions: string;
  skills: string[];
  links: AgentLink[];
  files: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  description?: string | null;
  parentAgentId: string | null;
}

export class AgentService extends Service {
  topLevelAgents$ = new LiveData<AgentSummary[]>([]);
  allAgents$ = new LiveData<AgentDetail[]>([]);

  private readonly agentSignals = new Map<string, LiveData<AgentDetail | null>>();

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly serverService: WorkspaceServerService
  ) {
    super();
  }

  private get gql(): GraphQLService {
    const server = this.serverService.server;
    if (!server) {
      throw new Error('WorkspaceServerService.server not bound yet');
    }
    return server.scope.get(GraphQLService);
  }

  private get workspaceId(): string {
    return this.workspaceService.workspace.id;
  }

  /**
   * Re-fetch the workspace's agents and update both `topLevelAgents$` and
   * `allAgents$`. Call after any mutation that may have changed the tree.
   */
  refresh = async () => {
    try {
      const result = (await this.gql.gql({
        query: listAgentsQuery,
        variables: { workspaceId: this.workspaceId, parentAgentId: null },
      } as any)) as unknown as { agents?: AgentDetail[] };
      const all = result.agents ?? [];
      this.allAgents$.next(all);
      this.topLevelAgents$.next(
        all
          .filter(a => !a.parentAgentId)
          .map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            parentAgentId: a.parentAgentId,
          }))
      );
    } catch (err) {
      console.warn('[agents] failed to load agents', err);
      this.allAgents$.next([]);
      this.topLevelAgents$.next([]);
    }
  };

  /**
   * Get a LiveData<AgentDetail|null> for one agent. Triggers a fetch on first
   * access and caches the LiveData per id.
   */
  agent$(id: string | undefined): LiveData<AgentDetail | null> {
    if (!id) return new LiveData<AgentDetail | null>(null);
    let live = this.agentSignals.get(id);
    if (!live) {
      live = new LiveData<AgentDetail | null>(null);
      this.agentSignals.set(id, live);
      // Fetch in background.
      this.fetchAgent(id).catch(err => {
        console.warn(`[agents] failed to fetch ${id}`, err);
      });
    }
    return live;
  }

  private async fetchAgent(id: string): Promise<void> {
    const result = (await this.gql.gql({
      query: getAgentQuery,
      variables: { id },
    } as any)) as unknown as { agent?: AgentDetail | null };
    const live = this.agentSignals.get(id);
    if (live) live.next(result.agent ?? null);
  }

  async createAgent(input: {
    name: string;
    description?: string;
    parentAgentId?: string;
    instructions?: string;
  }): Promise<{ id: string }> {
    const result = (await this.gql.gql({
      query: createAgentMutation,
      variables: {
        input: {
          workspaceId: this.workspaceId,
          ...input,
        },
      },
    } as any)) as unknown as { createAgent: AgentDetail };
    await this.refresh();
    return { id: result.createAgent.id };
  }

  async createSubAgent(input: {
    parentAgentId: string;
    name: string;
    description?: string;
  }): Promise<{ id: string }> {
    return this.createAgent(input);
  }

  async updateAgent(
    id: string,
    patch: { name?: string; description?: string; instructions?: string }
  ): Promise<void> {
    await this.gql.gql({
      query: updateAgentMutation,
      variables: { id, input: patch },
    } as any);
    await this.fetchAgent(id);
    await this.refresh();
  }

  async deleteAgent(id: string): Promise<void> {
    await this.gql.gql({
      query: deleteAgentMutation,
      variables: { id },
    } as any);
    this.agentSignals.delete(id);
    await this.refresh();
  }

  async addSkill(id: string, skill: string): Promise<void> {
    await this.gql.gql({
      query: addAgentSkillMutation,
      variables: { id, skill },
    } as any);
    await this.fetchAgent(id);
  }

  async removeSkill(id: string, skill: string): Promise<void> {
    await this.gql.gql({
      query: removeAgentSkillMutation,
      variables: { id, skill },
    } as any);
    await this.fetchAgent(id);
  }

  async addLink(id: string, url: string, label?: string): Promise<void> {
    await this.gql.gql({
      query: addAgentLinkMutation,
      variables: { id, url, label },
    } as any);
    await this.fetchAgent(id);
  }

  async removeLink(id: string, url: string): Promise<void> {
    await this.gql.gql({
      query: removeAgentLinkMutation,
      variables: { id, url },
    } as any);
    await this.fetchAgent(id);
  }

  async addFile(id: string, fileId: string): Promise<void> {
    await this.gql.gql({
      query: addAgentFileMutation,
      variables: { id, fileId },
    } as any);
    await this.fetchAgent(id);
  }

  async removeFile(id: string, fileId: string): Promise<void> {
    await this.gql.gql({
      query: removeAgentFileMutation,
      variables: { id, fileId },
    } as any);
    await this.fetchAgent(id);
  }
}

export function configureAgentsModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(AgentService, [WorkspaceService, WorkspaceServerService]);
}
