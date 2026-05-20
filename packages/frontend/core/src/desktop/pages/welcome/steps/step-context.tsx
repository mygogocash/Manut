import { Button } from '@affine/component/ui/button';
import { useCallback } from 'react';

import type { WizardContext } from '../graphql';
import * as styles from '../styles.css';

interface ContextOption {
  value: WizardContext;
  title: string;
  description: string;
}

const CONTEXT_OPTIONS: ReadonlyArray<ContextOption> = [
  {
    value: 'saas',
    title: 'SaaS / product',
    description: 'Building or running a product team.',
  },
  {
    value: 'agency',
    title: 'Agency or studio',
    description: 'Client work, deliverables, and timelines.',
  },
  {
    value: 'personal',
    title: 'Personal',
    description: 'Notes, planning, and life admin.',
  },
  {
    value: 'research',
    title: 'Research',
    description: 'Reading, learning, and writing things up.',
  },
  {
    value: 'other',
    title: 'Something else',
    description: 'Anything that doesn’t fit the others.',
  },
];

export interface StepContextProps {
  value: WizardContext | undefined;
  onChange: (value: WizardContext | undefined) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}

/**
 * Wizard step 2 — "What are you building?". A single-choice list of
 * categorical buckets that drives the Project plan template back on
 * the server (`buildProjectPlanMarkdown`).
 */
export const StepContext = ({
  value,
  onChange,
  onNext,
  onBack,
  disabled,
}: StepContextProps) => {
  const handleSelect = useCallback(
    (next: WizardContext) => {
      onChange(value === next ? undefined : next);
    },
    [onChange, value]
  );

  return (
    <>
      <header className={styles.greeting}>
        <h1 className={styles.headline}>What are you building?</h1>
        <p className={styles.subCopy}>
          Pick the closest match. We’ll tailor your starter docs to fit.
        </p>
      </header>
      <div className={styles.optionGridSingle}>
        {CONTEXT_OPTIONS.map(option => {
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
