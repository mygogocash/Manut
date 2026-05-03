import { Button, Input, Modal, notify } from '@affine/component';
import {
  MenuItem,
  MenuLinkItem,
} from '@affine/core/modules/app-sidebar/views';
import { AgentService } from '@affine/core/modules/agents';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { AiOutlineIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import * as styles from './agents-section.css';

interface AgentSummary {
  id: string;
  name: string;
  parentAgentId: string | null;
}

interface CreateAgentInput {
  name: string;
  description: string;
}

// Loose AgentLikeService kept as a structural type so the file compiles even
// when the real AgentService implementation is being landed by a sibling
// stream. `topLevelAgents$` is the real `LiveData<AgentSummary[]>` exported
// by `@affine/core/modules/agents`; we widen to `any` here to accept it.
interface AgentLikeService {
  topLevelAgents$: any;
  createAgent: (input: CreateAgentInput) => Promise<{ id: string }>;
  refresh?: () => void | Promise<void>;
}

const AgentRow = ({ agent }: { agent: AgentSummary }) => {
  const workbench = useService(WorkbenchService).workbench;
  const location = useLiveData(workbench.location$);
  const path = `/agents/${agent.id}`;
  const active = location.pathname === path;

  return (
    <MenuLinkItem
      data-testid={`sidebar-agent-row-${agent.id}`}
      icon={<AiOutlineIcon />}
      active={active}
      to={path}
    >
      <span>{agent.name || 'Untitled agent'}</span>
    </MenuLinkItem>
  );
};

interface CreateAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (agentId: string) => void;
}

const CreateAgentModal = ({
  open,
  onOpenChange,
  onCreated,
}: CreateAgentModalProps) => {
  const agentService = useService(AgentService) as unknown as AgentLikeService;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setDescription('');
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) {
        reset();
      }
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setSubmitting(true);
    try {
      const created = await agentService.createAgent({
        name: trimmed,
        description: description.trim(),
      });
      onCreated(created.id);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create agent', err);
      notify.error({
        title: 'Could not create agent',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      setSubmitting(false);
    }
  }, [agentService, description, name, onCreated, onOpenChange, reset]);

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="New agent"
      description="Create an agent to delegate tasks to."
      width={420}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalField}>
          <label className={styles.modalLabel} htmlFor="agent-name-input">
            Name
          </label>
          <Input
            id="agent-name-input"
            data-testid="create-agent-name-input"
            autoFocus
            placeholder="e.g. Research assistant"
            value={name}
            onChange={setName}
            maxLength={120}
            className={styles.modalInput}
          />
        </div>
        <div className={styles.modalField}>
          <label className={styles.modalLabel} htmlFor="agent-description-input">
            Description (optional)
          </label>
          <textarea
            id="agent-description-input"
            data-testid="create-agent-description-input"
            placeholder="What does this agent do?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={500}
            className={styles.modalTextarea}
          />
        </div>
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
        >
          <Button
            variant="secondary"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || name.trim().length === 0}
            data-testid="create-agent-confirm-button"
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const AgentsSection = () => {
  const agentService = useService(AgentService) as unknown as AgentLikeService;
  const agents = (useLiveData(agentService.topLevelAgents$) ??
    []) as AgentSummary[];
  const workbench = useService(WorkbenchService).workbench;
  const [modalOpen, setModalOpen] = useState(false);

  const handleAgentCreated = useCallback(
    (agentId: string) => {
      workbench.open(`/agents/${agentId}`);
    },
    [workbench]
  );

  const handleOpenCreate = useCallback(() => {
    setModalOpen(true);
  }, []);

  return (
    <div className={styles.sectionRoot} data-testid="sidebar-agents-section">
      <div className={styles.headerRow}>
        <span className={styles.headerLabel}>
          Agents
          <span className={styles.betaBadge}>Beta</span>
        </span>
      </div>
      {agents.length === 0 ? (
        <div className={styles.emptyHint}>No agents yet</div>
      ) : (
        agents.map(agent => <AgentRow key={agent.id} agent={agent} />)
      )}
      <MenuItem
        icon={<PlusIcon />}
        onClick={handleOpenCreate}
        data-testid="sidebar-agents-new-button"
      >
        <span>New agent</span>
      </MenuItem>
      <CreateAgentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={handleAgentCreated}
      />
    </div>
  );
};
