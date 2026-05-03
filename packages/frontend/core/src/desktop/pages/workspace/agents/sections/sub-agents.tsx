import { Button } from '@affine/component';
import { BlockIcon, PlusIcon } from '@blocksuite/icons/rc';
import { type FC } from 'react';

import * as styles from './sub-agents.css';

export interface SubAgentSummary {
  id: string;
  name: string;
}

export interface SubAgentsSectionProps {
  subAgents: SubAgentSummary[];
  onCreate: () => void;
  onOpen: (subAgentId: string) => void;
  disabled?: boolean;
}

export const SubAgentsSection: FC<SubAgentsSectionProps> = ({
  subAgents,
  onCreate,
  onOpen,
  disabled,
}) => {
  return (
    <section
      className={styles.section}
      aria-labelledby="agent-sub-agents-heading"
    >
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <BlockIcon />
        </span>
        <h3 id="agent-sub-agents-heading" className={styles.sectionTitle}>
          Sub-agents
        </h3>
      </div>
      <p className={styles.sectionDescription}>
        Create specialized sub-agents that can be invoked from this space.
      </p>

      {subAgents.length > 0 ? (
        <ul className={styles.list}>
          {subAgents.map(child => (
            <li key={child.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onOpen(child.id)}
                disabled={disabled}
              >
                <span className={styles.rowIcon} aria-hidden="true">
                  <BlockIcon />
                </span>
                <span className={styles.rowName}>{child.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No sub-agents yet.</p>
      )}

      <Button
        className={styles.addButton}
        prefix={<PlusIcon />}
        onClick={onCreate}
        disabled={disabled}
      >
        New sub-agent
      </Button>
    </section>
  );
};
