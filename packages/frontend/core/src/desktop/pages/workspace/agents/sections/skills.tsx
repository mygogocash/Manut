import { ToolIcon } from '@blocksuite/icons/rc';
import { type FC, useCallback } from 'react';

import * as styles from './skills.css';

export const AVAILABLE_SKILLS = [
  'web-search',
  'image-generation',
  'code-interpreter',
  'pdf-reader',
  'data-analysis',
] as const;

export type SkillId = (typeof AVAILABLE_SKILLS)[number];

export interface SkillsSectionProps {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

const SKILL_LABELS: Record<SkillId, string> = {
  'web-search': 'Web search',
  'image-generation': 'Image generation',
  'code-interpreter': 'Code interpreter',
  'pdf-reader': 'PDF reader',
  'data-analysis': 'Data analysis',
};

export const SkillsSection: FC<SkillsSectionProps> = ({
  selected,
  onChange,
  disabled,
}) => {
  const toggle = useCallback(
    (skill: SkillId) => {
      if (disabled) return;
      if (selected.includes(skill)) {
        onChange(selected.filter(s => s !== skill));
      } else {
        onChange([...selected, skill]);
      }
    },
    [disabled, selected, onChange]
  );

  return (
    <section className={styles.section} aria-labelledby="agent-skills-heading">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <ToolIcon />
        </span>
        <h3 id="agent-skills-heading" className={styles.sectionTitle}>
          Skills
        </h3>
      </div>
      <p className={styles.sectionDescription}>
        Extend what Computer can do in this space with reusable capabilities and
        actions. Computer applies skills automatically when needed.
      </p>
      <div className={styles.pillRow} role="group" aria-label="Available skills">
        {AVAILABLE_SKILLS.map(skill => {
          const isSelected = selected.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              className={styles.pill}
              data-selected={isSelected}
              data-disabled={!!disabled}
              onClick={() => toggle(skill)}
              disabled={disabled}
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <span className={styles.checkMark} aria-hidden="true">
                  ✓
                </span>
              ) : null}
              {SKILL_LABELS[skill]}
            </button>
          );
        })}
      </div>
    </section>
  );
};
