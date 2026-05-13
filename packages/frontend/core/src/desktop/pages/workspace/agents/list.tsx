import { AgentService } from '@affine/core/modules/agents';
import { WorkbenchLink } from '@affine/core/modules/workbench';
import { type LiveData, useLiveData, useService } from '@toeverything/infra';

import { AgentAvatar } from '../../../../components/agent-avatar';
import * as styles from './list.css';

interface AgentSummary {
  id: string;
  name: string;
  description?: string | null;
  parentAgentId: string | null;
}

interface AgentLikeService {
  topLevelAgents$: LiveData<AgentSummary[]>;
  refresh?: () => void | Promise<void>;
}

export const AgentsList = () => {
  const agentService = useService(AgentService) as unknown as AgentLikeService;
  const agents: AgentSummary[] =
    useLiveData(agentService.topLevelAgents$) ?? [];

  return (
    <div className={styles.body} data-testid="agents-list-page-body">
      <div className={styles.headerRow}>
        <div className={styles.title}>
          Agents
          <span className={styles.betaBadge}>Beta</span>
        </div>
      </div>
      <div className={styles.subtitle}>
        Create and manage agents that can run tasks on your behalf.
      </div>
      {agents.length === 0 ? (
        <div className={styles.empty}>
          You have no agents yet. Use the sidebar to create one.
        </div>
      ) : (
        <div className={styles.list}>
          {agents.map(agent => (
            <WorkbenchLink
              key={agent.id}
              to={`/agents/${agent.id}`}
              className={styles.listItem}
              data-testid={`agents-list-row-${agent.id}`}
            >
              <AgentAvatar
                agent={agent}
                size={28}
                className={styles.itemIcon}
              />
              <div className={styles.itemBody}>
                <div className={styles.itemName}>
                  {agent.name || 'Untitled agent'}
                </div>
                {agent.description ? (
                  <div className={styles.itemDescription}>
                    {agent.description}
                  </div>
                ) : null}
              </div>
            </WorkbenchLink>
          ))}
        </div>
      )}
    </div>
  );
};
