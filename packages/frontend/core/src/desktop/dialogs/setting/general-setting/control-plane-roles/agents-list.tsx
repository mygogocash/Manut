import { Button } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type MnAgentDto,
  mnAgentsQuery,
  type MnAgentStatus,
} from '@affine/core/modules/manut-control-plane';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { Suspense, useCallback, useMemo, useState } from 'react';

import { AgentCreateForm } from './agent-create-form';
import { AgentDetailDrawer } from './agent-detail-drawer';
import * as styles from './agents-list.css';

// en-only copy; threaded through to share the dictionary with the existing
// roles panel until we open the i18n discussion for the whole control plane.
const AGENTS_UNAVAILABLE_MESSAGE =
  'Agent registry is not enabled on this workspace. Ask your administrator to enable the Manut control plane.';

function errorBoxMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) {
    return AGENTS_UNAVAILABLE_MESSAGE;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

interface StatusPillProps {
  status: MnAgentStatus;
}

const StatusPill = ({ status }: StatusPillProps) => {
  const variant =
    status === 'active'
      ? styles.statusActive
      : status === 'paused'
        ? styles.statusPaused
        : styles.statusTerminated;
  return (
    <span
      className={`${styles.statusPill} ${variant}`}
      data-testid="cp-agent-status-pill"
      data-status={status}
    >
      {status}
    </span>
  );
};

const SkeletonList = () => (
  <div className={styles.skeletonGroup}>
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
  </div>
);

interface AgentsTableProps {
  workspaceId: string;
  projectId?: string | null;
  onOpenAgent: (agent: MnAgentDto) => void;
  onCreateAgent: () => void;
}

const AgentsTable = ({
  workspaceId,
  projectId,
  onOpenAgent,
  onCreateAgent,
}: AgentsTableProps) => {
  const queryArg = {
    query: mnAgentsQuery,
    variables: { workspaceId, projectId: projectId ?? null },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error } = useQuery(queryArg);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load agents: {errorBoxMessage(error)}
      </div>
    );
  }

  const agents = (data as unknown as { mnAgents?: MnAgentDto[] } | undefined)
    ?.mnAgents;

  if (!agents || agents.length === 0) {
    return (
      <div className={styles.emptyState} data-testid="cp-agents-empty">
        <div style={{ marginBottom: 8 }}>
          No agents have been registered for this workspace yet.
        </div>
        <Button
          variant="primary"
          onClick={onCreateAgent}
          data-testid="cp-agents-empty-create"
        >
          Register first agent
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Role</th>
            <th className={styles.th}>Adapter</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Last heartbeat</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, index) => {
            const isLast = index === agents.length - 1;
            const tdClass = isLast
              ? `${styles.td} ${styles.lastRowTd}`
              : styles.td;
            return (
              <tr
                key={agent.id}
                data-testid="cp-agent-row"
                className={styles.row}
                onClick={() => onOpenAgent(agent)}
              >
                <td className={`${tdClass} ${styles.nameCell}`}>
                  <div data-testid="cp-agent-name">{agent.name}</div>
                  <div className={styles.monoCell}>{agent.id}</div>
                </td>
                <td className={`${tdClass} ${styles.monoCell}`}>
                  {agent.roleTemplate}
                </td>
                <td className={`${tdClass} ${styles.monoCell}`}>
                  {agent.adapterType}
                </td>
                <td className={tdClass}>
                  <StatusPill status={agent.status} />
                </td>
                <td className={tdClass}>
                  {formatTimestamp(agent.lastHeartbeatAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface AgentsListPanelProps {
  workspaceId: string;
  projectId?: string | null;
}

export const AgentsListPanel = ({
  workspaceId,
  projectId,
}: AgentsListPanelProps) => {
  const [creating, setCreating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<MnAgentDto | null>(null);

  const handleOpenAgent = useCallback((agent: MnAgentDto) => {
    setSelectedAgent(agent);
  }, []);

  const handleCloseAgent = useCallback(() => {
    setSelectedAgent(null);
  }, []);

  const handleCreateAgent = useCallback(() => {
    setCreating(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setCreating(false);
  }, []);

  const handleCreated = useCallback((agent: MnAgentDto) => {
    setCreating(false);
    setSelectedAgent(agent);
  }, []);

  const fallback = useMemo(() => <SkeletonList />, []);

  return (
    <div className={styles.root} data-testid="cp-agents-panel">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Agents</div>
          <div className={styles.muted}>
            Per-workspace registered workers. Each agent binds to a project, a
            role template, and an adapter. Click a row to view detail, mint API
            keys, and pause/terminate.
          </div>
        </div>
        <Button
          variant="primary"
          onClick={handleCreateAgent}
          data-testid="cp-agents-create-button"
        >
          Register agent
        </Button>
      </div>

      <Suspense fallback={fallback}>
        <AgentsTable
          workspaceId={workspaceId}
          projectId={projectId}
          onOpenAgent={handleOpenAgent}
          onCreateAgent={handleCreateAgent}
        />
      </Suspense>

      {/* Mount the form modal only while open so its internal `useQuery`
          for the project picker doesn't suspend the table render. */}
      {creating ? (
        <AgentCreateForm
          open
          workspaceId={workspaceId}
          defaultProjectId={projectId ?? null}
          onClose={handleCloseCreate}
          onCreated={handleCreated}
        />
      ) : null}

      {/* Likewise gate the detail drawer so its agent-by-id + heartbeat
          queries don't fire until a row is opened. */}
      {selectedAgent ? (
        <AgentDetailDrawer
          open
          agent={selectedAgent}
          onClose={handleCloseAgent}
        />
      ) : null}
    </div>
  );
};
