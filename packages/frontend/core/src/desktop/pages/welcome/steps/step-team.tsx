import { Button } from '@affine/component/ui/button';
import { useCallback } from 'react';

import type { WizardTeam } from '../graphql';
import * as styles from '../styles.css';

interface TeamOption {
  value: WizardTeam;
  title: string;
  description: string;
}

const TEAM_OPTIONS: ReadonlyArray<TeamOption> = [
  {
    value: 'solo',
    title: 'Just me',
    description: 'No team to coordinate yet.',
  },
  {
    value: '2-5',
    title: '2 – 5 people',
    description: 'A small, tight crew.',
  },
  {
    value: '6-20',
    title: '6 – 20 people',
    description: 'A growing team with multiple roles.',
  },
  {
    value: '20+',
    title: 'More than 20',
    description: 'A larger org with several functions.',
  },
];

export interface StepTeamProps {
  value: WizardTeam | undefined;
  onChange: (value: WizardTeam | undefined) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}

/**
 * Wizard step 3 — "Who's on your team?". Server uses this to decide
 * whether to seed an extra Team Notes starter doc (skipped when
 * `solo`).
 */
export const StepTeam = ({
  value,
  onChange,
  onNext,
  onBack,
  disabled,
}: StepTeamProps) => {
  const handleSelect = useCallback(
    (next: WizardTeam) => {
      onChange(value === next ? undefined : next);
    },
    [onChange, value]
  );

  return (
    <>
      <header className={styles.greeting}>
        <h1 className={styles.headline}>Who&rsquo;s on your team?</h1>
        <p className={styles.subCopy}>
          So we know whether to pre-seed shared docs for the group.
        </p>
      </header>
      <div className={styles.optionGrid}>
        {TEAM_OPTIONS.map(option => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              className={`${styles.option} ${
                isSelected ? styles.optionSelected : ''
              }`}
              onClick={() => handleSelect(option.value)}
            >
              <span
                className={`${styles.checkbox} ${
                  isSelected ? styles.checkboxChecked : ''
                }`}
                aria-hidden="true"
              >
                {isSelected ? '✓' : null}
              </span>
              <span className={styles.optionLabel}>
                <span className={styles.optionTitle}>{option.title}</span>
                <span className={styles.optionDescription}>
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.navRow}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          disabled={disabled}
        >
          Back
        </button>
        <Button
          variant="primary"
          size="large"
          className={styles.submitButton}
          disabled={disabled || !value}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </>
  );
};
