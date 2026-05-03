import { notify } from '@affine/component';
import { AgentService } from '@affine/core/modules/agents';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { useLiveData, useService } from '@toeverything/infra';
import { nanoid } from 'nanoid';
import {
  type ChangeEvent,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import {
  AgentAvatar,
  type AgentAvatarConfig,
} from '../../../../components/agent-avatar';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './detail.css';
import { AvatarSection } from './sections/avatar';
import { type AgentFile, FilesSection } from './sections/files';
import { InstructionsSection } from './sections/instructions';
import { type AgentLink, LinksSection } from './sections/links';
import { SkillsSection } from './sections/skills';
import { SubAgentsSection, type SubAgentSummary } from './sections/sub-agents';

// ----- Defensive shapes for AgentService (the agents module is owned by another agent) -----

interface AgentDetail {
  id: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  files?: AgentFile[];
  skills?: string[];
  links?: AgentLink[];
  subAgents?: SubAgentSummary[];
  parentAgentId?: string | null;
  // Avatar is owned by the backend agent; we accept it defensively here so
  // the picker can read & write through `updateAgent({ avatar })`.
  avatar?: AgentAvatarConfig | null;
}

interface UpdateAgentPatch {
  name?: string;
  description?: string;
  instructions?: string;
  files?: AgentFile[];
  skills?: string[];
  links?: AgentLink[];
  avatar?: AgentAvatarConfig;
}

interface CreateSubAgentInput {
  parentAgentId: string;
  name: string;
}

interface AgentLikeService {
  // Top-level agents are always available per the sibling list/sidebar code.
  // Sub-agents are nested under `subAgents`. If the backing service exposes a
  // flat `allAgents$`, prefer that — otherwise we walk the tree from the top.
  // eslint-disable-next-line rxjs/finnish
  topLevelAgents$: any;
  // eslint-disable-next-line rxjs/finnish
  allAgents$?: any;

  updateAgent?: (id: string, patch: UpdateAgentPatch) => Promise<void>;
  createSubAgent?: (input: CreateSubAgentInput) => Promise<{ id: string }>;
  refresh?: () => void | Promise<void>;
}

function findAgentInTree(
  pool: AgentDetail[] | undefined,
  agentId: string
): AgentDetail | undefined {
  if (!pool) return undefined;
  for (const a of pool) {
    if (a.id === agentId) return a;
    const nested = a.subAgents as AgentDetail[] | undefined;
    if (nested && nested.length > 0) {
      const found = findAgentInTree(nested, agentId);
      if (found) return found;
    }
  }
  return undefined;
}

// ----- Page implementation -----

const AgentDetailPage: FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const agentService = useService(AgentService) as unknown as AgentLikeService;
  const workbench = useService(WorkbenchService).workbench;

  // Subscribe to top-level agents and (when available) the flat aggregate list.
  // Hooks must run unconditionally, so we don't gate these calls on agentId.
  const topAgents = useLiveData(agentService.topLevelAgents$);
  const allAgentsLive = useLiveData(
    (agentService.allAgents$ as
      | undefined
      | typeof agentService.topLevelAgents$) ?? agentService.topLevelAgents$
  );
  const agent = useMemo<AgentDetail | undefined>(() => {
    if (!agentId) return undefined;
    return (
      findAgentInTree(allAgentsLive as AgentDetail[] | undefined, agentId) ??
      findAgentInTree(topAgents as AgentDetail[] | undefined, agentId)
    );
  }, [agentId, allAgentsLive, topAgents]);

  // Local edit buffers for inline-editable fields. We commit to the service on blur.
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');

  useEffect(() => {
    setNameDraft(agent?.name ?? '');
    setDescriptionDraft(agent?.description ?? '');
  }, [agent?.id, agent?.name, agent?.description]);

  const updateAgent = useCallback(
    async (patch: UpdateAgentPatch) => {
      if (!agentId) return;
      if (!agentService.updateAgent) {
        // The backing service has not implemented updates yet — surface a
        // clear error rather than silently dropping the change.
        notify.error({
          title: 'Cannot save changes',
          message: 'Agent updates are not available in this build.',
        });
        return;
      }
      try {
        await agentService.updateAgent(agentId, patch);
      } catch (err) {
        console.error('Failed to update agent', err);
        notify.error({
          title: 'Could not save changes',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [agentService, agentId]
  );

  const handleNameBlur = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (!agent) return;
    if (trimmed && trimmed !== agent.name) {
      updateAgent({ name: trimmed }).catch(console.error);
    } else if (!trimmed) {
      // Refuse empty: revert.
      setNameDraft(agent.name);
    }
  }, [agent, nameDraft, updateAgent]);

  const handleDescriptionBlur = useCallback(() => {
    const trimmed = descriptionDraft.trim();
    if (!agent) return;
    if (trimmed !== (agent.description ?? '')) {
      updateAgent({ description: trimmed }).catch(console.error);
    }
  }, [agent, descriptionDraft, updateAgent]);

  const handleInstructionsChange = useCallback(
    (next: string) => {
      updateAgent({ instructions: next }).catch(console.error);
    },
    [updateAgent]
  );

  const handleFilesAdd = useCallback(
    (newFiles: File[]) => {
      if (!agent) return;
      const additions: AgentFile[] = newFiles.map(f => ({
        id: nanoid(),
        name: f.name,
        size: f.size,
      }));
      updateAgent({ files: [...(agent.files ?? []), ...additions] }).catch(
        console.error
      );
    },
    [agent, updateAgent]
  );

  const handleFileRemove = useCallback(
    (fileId: string) => {
      if (!agent) return;
      const next = (agent.files ?? []).filter(f => f.id !== fileId);
      updateAgent({ files: next }).catch(console.error);
    },
    [agent, updateAgent]
  );

  const handleSkillsChange = useCallback(
    (skills: string[]) => {
      updateAgent({ skills }).catch(console.error);
    },
    [updateAgent]
  );

  const handleLinkAdd = useCallback(
    (url: string, label?: string) => {
      if (!agent) return;
      const next: AgentLink[] = [
        ...(agent.links ?? []),
        { id: nanoid(), url, label },
      ];
      updateAgent({ links: next }).catch(console.error);
    },
    [agent, updateAgent]
  );

  const handleLinkRemove = useCallback(
    (linkId: string) => {
      if (!agent) return;
      const next = (agent.links ?? []).filter(l => l.id !== linkId);
      updateAgent({ links: next }).catch(console.error);
    },
    [agent, updateAgent]
  );

  const handleAvatarChange = useCallback(
    (next: AgentAvatarConfig) => {
      updateAgent({ avatar: next }).catch(console.error);
    },
    [updateAgent]
  );

  const handleCreateSubAgent = useCallback(async () => {
    if (!agentId) return;
    if (!agentService.createSubAgent) {
      notify.error({
        title: 'Cannot create sub-agent',
        message: 'Sub-agent creation is not available in this build.',
      });
      return;
    }
    try {
      const created = await agentService.createSubAgent({
        parentAgentId: agentId,
        name: 'Untitled sub-agent',
      });
      workbench.open(`/agents/${created.id}`);
    } catch (err) {
      console.error('Failed to create sub-agent', err);
      notify.error({
        title: 'Could not create sub-agent',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [agentService, agentId, workbench]);

  const handleOpenSubAgent = useCallback(
    (subAgentId: string) => {
      workbench.open(`/agents/${subAgentId}`);
    },
    [workbench]
  );

  const subAgents = agent?.subAgents ?? [];
  const files = agent?.files ?? [];
  const links = agent?.links ?? [];
  const skills = agent?.skills ?? [];
  const instructions = agent?.instructions ?? '';

  const titleText = agent?.name?.trim() || 'Agent';

  return (
    <>
      <ViewTitle title={titleText} />
      <ViewIcon icon="ai" />
      <ViewHeader />
      <ViewBody>
        <div
          className={styles.root}
          data-testid="agent-detail-page"
          data-agent-id={agentId}
        >
          {!agentId ? (
            <div className={styles.notFound}>
              <span className={styles.notFoundTitle}>Agent not found</span>
              <span>No agent id provided in the URL.</span>
            </div>
          ) : !agent ? (
            <div className={styles.loading}>Loading agent…</div>
          ) : (
            <div className={styles.scroll}>
              <div className={styles.inner}>
                <header className={styles.header}>
                  <div className={styles.headerTitleRow}>
                    <AgentAvatar agent={agent} size={56} />
                    <div className={styles.headerInputs}>
                      <input
                        type="text"
                        className={styles.nameInput}
                        value={nameDraft}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setNameDraft(e.target.value)
                        }
                        onBlur={handleNameBlur}
                        placeholder="Untitled agent"
                        aria-label="Agent name"
                        maxLength={120}
                        data-testid="agent-detail-name-input"
                      />
                      <textarea
                        className={styles.descriptionInput}
                        value={descriptionDraft}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          setDescriptionDraft(e.target.value)
                        }
                        onBlur={handleDescriptionBlur}
                        placeholder="Add a description for this agent…"
                        aria-label="Agent description"
                        rows={2}
                        maxLength={500}
                        data-testid="agent-detail-description-input"
                      />
                    </div>
                  </div>
                </header>

                <div className={styles.sections}>
                  <AvatarSection
                    agentId={agent.id}
                    agentName={agent.name}
                    value={agent.avatar ?? undefined}
                    onChange={handleAvatarChange}
                  />
                  <InstructionsSection
                    value={instructions}
                    onChange={handleInstructionsChange}
                  />
                  <FilesSection
                    files={files}
                    onAdd={handleFilesAdd}
                    onRemove={handleFileRemove}
                  />
                  <SkillsSection
                    selected={skills}
                    onChange={handleSkillsChange}
                  />
                  <LinksSection
                    links={links}
                    onAdd={handleLinkAdd}
                    onRemove={handleLinkRemove}
                  />
                  <SubAgentsSection
                    subAgents={subAgents}
                    onCreate={() => {
                      handleCreateSubAgent().catch(console.error);
                    }}
                    onOpen={handleOpenSubAgent}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AgentDetailPage />;
};
