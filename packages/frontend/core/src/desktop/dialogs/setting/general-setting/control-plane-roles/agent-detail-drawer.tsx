import { Button, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  createMnAgentApiKeyMutation,
  deleteMnAgentMutation,
  disableMnAgentMaximizerMutation,
  enableMnAgentMaximizerMutation,
  type MnAgentApiKeyDto,
  type MnAgentDto,
  mnAgentHeartbeatRunsQuery,
  type MnAgentMaximizerToggleResultDto,
  mnAgentQuery,
  type MnAgentStatus,
  type MnHeartbeatRunDto,
  revokeMnAgentApiKeyMutation,
  updateMnAgentStatusMutation,
} from '@affine/core/modules/manut-control-plane';
import { Suspense, useCallback, useMemo, useState } from 'react';

import * as styles from './agent-detail-drawer.css';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

interface AgentDetailContentProps {
  agentId: string;
  fallbackAgent: MnAgentDto;
  onClose: () => void;
}

interface AgentDetailDrawerProps {
  open: boolean;
  agent: MnAgentDto | null;
  onClose: () => void;
}

interface ApiKeysSectionProps {
  agentId: string;
  apiKeys: ReadonlyArray<MnAgentApiKeyDto>;
}

interface HeartbeatRunsSectionProps {
  agentId: string;
}

const HeartbeatRunsTable = ({ agentId }: HeartbeatRunsSectionProps) => {
  const queryArg = {
    query: mnAgentHeartbeatRunsQuery,
    variables: { agentId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error } = useQuery(queryArg);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Could not load heartbeat runs: {errorMessage(error)}
      </div>
    );
  }

  const runs =
    (
      data as unknown as
        | { mnAgentHeartbeatRuns?: MnHeartbeatRunDto[] }
        | undefined
    )?.mnAgentHeartbeatRuns ?? [];

  if (runs.length === 0) {
    return (
      <div
        className={styles.emptyApiKeys}
        data-testid="cp-agent-heartbeats-empty"
      >
        No heartbeat runs recorded yet.
      </div>
    );
  }

  return (
    <div data-testid="cp-agent-heartbeats">
      {runs.map(run => (
        <div key={run.id} className={styles.heartbeatRow}>
          <span
            data-testid="cp-agent-heartbeat-status"
            data-status={run.status}
          >
            {run.status}
          </span>
          <span>{formatTimestamp(run.startedAt)}</span>
          <span>{formatDuration(run.durationMs)}</span>
        </div>
      ))}
    </div>
  );
};

const ApiKeysSection = ({ agentId, apiKeys }: ApiKeysSectionProps) => {
  const [minting, setMinting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [mintedKey, setMintedKey] = useState<MnAgentApiKeyDto | null>(null);

  const { trigger: triggerCreate } = useMutation({
    mutation: createMnAgentApiKeyMutation,
  });
  const { trigger: triggerRevoke } = useMutation({
    mutation: revokeMnAgentApiKeyMutation,
  });

  const handleMint = useCallback(async () => {
    setMinting(true);
    try {
      const response = (await (
        triggerCreate as (args: unknown) => Promise<unknown>
      )({
        input: { agentId },
      })) as { createMnAgentApiKey?: MnAgentApiKeyDto } | undefined;
      const created = response?.createMnAgentApiKey;
      if (!created) {
        throw new Error('Server did not return the new API key.');
      }
      setMintedKey(created);
      notify.success({
        title: 'API key minted',
        message: 'Copy the token now — it will not be shown again.',
      });
    } catch (err) {
      notify.error({
        title: 'Could not mint API key',
        message: errorMessage(err),
      });
    } finally {
      setMinting(false);
    }
  }, [agentId, triggerCreate]);

  const handleRevoke = useCallback(
    async (apiKey: MnAgentApiKeyDto) => {
      setRevokingId(apiKey.id);
      try {
        await (triggerRevoke as (args: unknown) => Promise<unknown>)({
          id: apiKey.id,
        });
        notify.success({
          title: 'API key revoked',
          message: `Token ending …${apiKey.tokenSuffix}`,
        });
      } catch (err) {
        notify.error({
          title: 'Could not revoke API key',
          message: errorMessage(err),
        });
      } finally {
        setRevokingId(null);
      }
    },
    [triggerRevoke]
  );

  const activeKeys = useMemo(
    () => apiKeys.filter(key => !key.revokedAt),
    [apiKeys]
  );
  const revokedKeys = useMemo(
    () => apiKeys.filter(key => key.revokedAt),
    [apiKeys]
  );

  return (
    <section className={styles.section} data-testid="cp-agent-apikeys-section">
      <div className={styles.sectionTitle}>API keys</div>

      {mintedKey?.plaintextToken ? (
        <div
          className={styles.mintedBanner}
          role="alert"
          data-testid="cp-agent-apikey-minted"
        >
          <div>
            New API key minted. Copy this token now — for security, the
            plaintext value is shown only once.
          </div>
          <div className={styles.mintedTokenBox}>
            <span>{mintedKey.plaintextToken}</span>
          </div>
        </div>
      ) : null}

      <div className={styles.apiKeyList}>
        {activeKeys.length === 0 ? (
          <div className={styles.emptyApiKeys}>
            No active API keys. Mint one for an adapter to authenticate.
          </div>
        ) : (
          activeKeys.map(key => (
            <div
              key={key.id}
              className={styles.apiKeyRow}
              data-testid="cp-agent-apikey-row"
            >
              <div>
                <div className={styles.apiKeyTokenLabel}>
                  …{key.tokenSuffix}
                </div>
                <div className={styles.apiKeyMeta}>
                  Created {formatTimestamp(key.createdAt)}
                </div>
              </div>
              <Button
                onClick={() => void handleRevoke(key)}
                loading={revokingId === key.id}
                disabled={revokingId !== null}
                data-testid="cp-agent-apikey-revoke"
              >
                Revoke
              </Button>
            </div>
          ))
        )}

        {revokedKeys.map(key => (
          <div
            key={key.id}
            className={`${styles.apiKeyRow} ${styles.apiKeyRowRevoked}`}
            data-testid="cp-agent-apikey-row-revoked"
          >
            <div>
              <div className={styles.apiKeyTokenLabel}>…{key.tokenSuffix}</div>
              <div className={styles.apiKeyMeta}>
                Revoked {formatTimestamp(key.revokedAt)}
              </div>
            </div>
            <span className={styles.apiKeyMeta}>revoked</span>
          </div>
        ))}
      </div>

      <div>
        <Button
          variant="primary"
          onClick={() => void handleMint()}
          loading={minting}
          disabled={minting}
          data-testid="cp-agent-apikey-mint"
        >
          Mint API key
        </Button>
      </div>
    </section>
  );
};

interface MaximizerToggleSectionProps {
  agentId: string;
  agentName: string;
  initialMaximizerMode: boolean;
}

const MaximizerToggleSection = ({
  agentId,
  agentName,
  initialMaximizerMode,
}: MaximizerToggleSectionProps) => {
  const [maximizerMode, setMaximizerMode] =
    useState<boolean>(initialMaximizerMode);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const { trigger: triggerEnable, isMutating: enableMutating } = useMutation({
    mutation: enableMnAgentMaximizerMutation,
  });
  const { trigger: triggerDisable, isMutating: disableMutating } = useMutation({
    mutation: disableMnAgentMaximizerMutation,
  });

  const mutating = enableMutating || disableMutating;

  const applyEnable = useCallback(async () => {
    try {
      const response = (await (
        triggerEnable as (args: unknown) => Promise<unknown>
      )({
        agentId,
      })) as
        | { enableMnAgentMaximizer?: MnAgentMaximizerToggleResultDto }
        | undefined;
      const next = response?.enableMnAgentMaximizer?.maximizerMode ?? true;
      setMaximizerMode(next);
      notify.success({
        title: 'Maximizer mode enabled',
        message: `${agentName} now runs in high-autonomy mode.`,
      });
    } catch (err) {
      notify.error({
        title: 'Could not enable maximizer mode',
        message: errorMessage(err),
      });
    } finally {
      setConfirmOpen(false);
    }
  }, [agentId, agentName, triggerEnable]);

  const handleToggle = useCallback(async () => {
    if (maximizerMode) {
      try {
        const response = (await (
          triggerDisable as (args: unknown) => Promise<unknown>
        )({
          agentId,
        })) as
          | { disableMnAgentMaximizer?: MnAgentMaximizerToggleResultDto }
          | undefined;
        const next = response?.disableMnAgentMaximizer?.maximizerMode ?? false;
        setMaximizerMode(next);
        notify.success({
          title: 'Maximizer mode disabled',
          message: `${agentName} reverted to standard dispatch.`,
        });
      } catch (err) {
        notify.error({
          title: 'Could not disable maximizer mode',
          message: errorMessage(err),
        });
      }
      return;
    }
    // Enabling requires confirmation.
    setConfirmOpen(true);
  }, [agentId, agentName, maximizerMode, triggerDisable]);

  return (
    <section
      className={styles.section}
      data-testid="cp-agent-maximizer-section"
    >
      <div className={styles.sectionTitle}>MAXIMIZER MODE</div>
      <div className={styles.factGrid}>
        <div className={styles.factLabel}>Status</div>
        <div
          className={styles.factValue}
          data-testid="cp-agent-maximizer-status"
          data-maximizer={maximizerMode ? 'on' : 'off'}
        >
          {maximizerMode ? 'ON — high-autonomy execution' : 'OFF (default)'}
        </div>
      </div>
      <div className={styles.apiKeyMeta}>
        When ON, the orchestrator auto-delegates capability-matched tool calls
        to subordinate agents, batches the rest into groups of 10, forces
        approval for any call costing &gt;50% of remaining monthly budget, and
        runs full M11 outcome verification on every DONE transition. Use only
        when you trust the agent to act without per-call human review.
      </div>
      <div className={styles.actionRow}>
        <Button
          variant={maximizerMode ? undefined : 'primary'}
          onClick={() => void handleToggle()}
          disabled={mutating}
          loading={mutating}
          data-testid="cp-agent-maximizer-toggle"
        >
          {maximizerMode ? 'Turn OFF maximizer' : 'Turn ON maximizer'}
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onOpenChange={(value: boolean) => {
          if (!value) setConfirmOpen(false);
        }}
        title="Enable MAXIMIZER MODE?"
        description={
          `${agentName} will run in high-autonomy mode. It can ` +
          'auto-delegate work, dispatch in batches of 10, and skip ' +
          'per-call human review except for high-cost calls. You can ' +
          'turn it off at any time.'
        }
      >
        <div className={styles.actionRow}>
          <Button
            onClick={() => setConfirmOpen(false)}
            data-testid="cp-agent-maximizer-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void applyEnable()}
            loading={enableMutating}
            disabled={enableMutating}
            data-testid="cp-agent-maximizer-confirm"
          >
            Enable maximizer mode
          </Button>
        </div>
      </Modal>
    </section>
  );
};

const AgentDetailContent = ({
  agentId,
  fallbackAgent,
  onClose,
}: AgentDetailContentProps) => {
  const queryArg = {
    query: mnAgentQuery,
    variables: { id: agentId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error } = useQuery(queryArg);

  const { trigger: triggerStatus, isMutating: statusMutating } = useMutation({
    mutation: updateMnAgentStatusMutation,
  });
  const { trigger: triggerDelete, isMutating: deleteMutating } = useMutation({
    mutation: deleteMnAgentMutation,
  });

  const fetched = (data as unknown as { mnAgent?: MnAgentDto } | undefined)
    ?.mnAgent;
  const agent = fetched ?? fallbackAgent;

  const handleStatusChange = useCallback(
    async (next: MnAgentStatus) => {
      try {
        await (triggerStatus as (args: unknown) => Promise<unknown>)({
          id: agent.id,
          input: { status: next },
        });
        notify.success({
          title: 'Status updated',
          message: `${agent.name} is now ${next}`,
        });
      } catch (err) {
        notify.error({
          title: 'Could not update status',
          message: errorMessage(err),
        });
      }
    },
    [agent.id, agent.name, triggerStatus]
  );

  const handleTerminate = useCallback(async () => {
    try {
      await (triggerDelete as (args: unknown) => Promise<unknown>)({
        id: agent.id,
      });
      notify.success({
        title: 'Agent terminated',
        message: agent.name,
      });
      onClose();
    } catch (err) {
      notify.error({
        title: 'Could not terminate agent',
        message: errorMessage(err),
      });
    }
  }, [agent.id, agent.name, onClose, triggerDelete]);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Could not load agent: {errorMessage(error)}
      </div>
    );
  }

  const mutating = statusMutating || deleteMutating;

  return (
    <div className={styles.root}>
      <div className={styles.headerBlock}>
        <div className={styles.headerTitle} data-testid="cp-agent-detail-name">
          {agent.name}
        </div>
        <div className={styles.headerMeta}>{agent.id}</div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Facts</div>
        <div className={styles.factGrid}>
          <div className={styles.factLabel}>Status</div>
          <div
            className={styles.factValue}
            data-testid="cp-agent-detail-status"
          >
            {agent.status}
          </div>

          <div className={styles.factLabel}>Role template</div>
          <div className={`${styles.factValue} ${styles.factMono}`}>
            {agent.roleTemplate}
          </div>

          <div className={styles.factLabel}>Adapter</div>
          <div className={`${styles.factValue} ${styles.factMono}`}>
            {agent.adapterType}
          </div>

          <div className={styles.factLabel}>Project</div>
          <div className={`${styles.factValue} ${styles.factMono}`}>
            {agent.projectId ?? '(workspace-wide)'}
          </div>

          <div className={styles.factLabel}>Last heartbeat</div>
          <div className={styles.factValue}>
            {formatTimestamp(agent.lastHeartbeatAt)}
          </div>

          <div className={styles.factLabel}>Created</div>
          <div className={styles.factValue}>
            {formatTimestamp(agent.createdAt)}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Lifecycle</div>
        <div className={styles.actionRow}>
          {agent.status === 'active' ? (
            <Button
              onClick={() => void handleStatusChange('paused')}
              disabled={mutating}
              data-testid="cp-agent-detail-pause"
            >
              Pause
            </Button>
          ) : agent.status === 'paused' ? (
            <Button
              variant="primary"
              onClick={() => void handleStatusChange('active')}
              disabled={mutating}
              data-testid="cp-agent-detail-resume"
            >
              Resume
            </Button>
          ) : (
            <span className={styles.apiKeyMeta}>Agent is terminated.</span>
          )}
          {agent.status !== 'terminated' ? (
            <Button
              onClick={() => void handleTerminate()}
              disabled={mutating}
              loading={deleteMutating}
              data-testid="cp-agent-detail-terminate"
            >
              Terminate
            </Button>
          ) : null}
        </div>
      </section>

      <ApiKeysSection agentId={agent.id} apiKeys={agent.apiKeys ?? []} />

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Recent heartbeats</div>
        <Suspense
          fallback={
            <div className={styles.emptyApiKeys}>Loading heartbeat runs…</div>
          }
        >
          <HeartbeatRunsTable agentId={agent.id} />
        </Suspense>
      </section>

      <MaximizerToggleSection
        agentId={agent.id}
        agentName={agent.name}
        initialMaximizerMode={agent.maximizerMode ?? false}
      />
    </div>
  );
};

/**
 * Modal-based drawer for inspecting and operating on a single MnAgent.
 *
 * AFFiNE's design-system Modal is the closest primitive we have for a
 * drawer-style detail surface; once the team ships a real Drawer we can
 * swap the wrapper here without touching the body.
 */
export const AgentDetailDrawer = ({
  open,
  agent,
  onClose,
}: AgentDetailDrawerProps) => {
  if (!agent) {
    return null;
  }
  return (
    <Modal
      open={open}
      onOpenChange={(value: boolean) => {
        if (!value) onClose();
      }}
      title="Agent detail"
      description="Inspect facts, mint API keys, and control the agent's lifecycle."
      width={640}
    >
      <Suspense
        fallback={<div className={styles.emptyApiKeys}>Loading agent…</div>}
      >
        <AgentDetailContent
          agentId={agent.id}
          fallbackAgent={agent}
          onClose={onClose}
        />
      </Suspense>
    </Modal>
  );
};
