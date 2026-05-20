import { Button } from '@affine/component/ui/button';
import { useCallback } from 'react';

import type { WizardApp } from '../graphql';
import * as styles from '../styles.css';

interface AppOption {
  value: WizardApp;
  title: string;
  description: string;
  /** Marker for apps that aren't shippable yet (e.g. GitHub M2 E2.1 BLOCKED). */
  comingSoon?: boolean;
}

const APP_OPTIONS: ReadonlyArray<AppOption> = [
  {
    value: 'gmail',
    title: 'Gmail',
    description: 'Bring conversations into your workspace.',
  },
  {
    value: 'calendar',
    title: 'Google Calendar',
    description: 'See upcoming events alongside your work.',
  },
  {
    value: 'github',
    title: 'GitHub',
    description: 'Pull request and issue context in Manut.',
    comingSoon: true,
  },
];

export interface StepAppsProps {
  selectedApps: WizardApp[];
  onToggle: (app: WizardApp) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}

/**
 * Wizard step 4 — "What apps do you live in?". Multi-select. The
 * actual OAuth handshakes happen AFTER workspace creation: each
 * selected app gets a Connect button on the final submit screen
 * (or we drop the user into the matching settings tab).
 *
 * GitHub is marked "Coming soon" because M2 E2.1 (the upstream
 * connector epic) is still BLOCKED per the plan. The placeholder
 * still toggles, but the final-screen Connect button is disabled.
 */
export const StepApps = ({
  selectedApps,
  onToggle,
  onNext,
  onBack,
  disabled,
}: StepAppsProps) => {
  const handleToggle = useCallback(
    (app: WizardApp) => {
      onToggle(app);
    },
    [onToggle]
  );

  return (
    <>
      <header className={styles.greeting}>
        <h1 className={styles.headline}>What apps do you live in?</h1>
        <p className={styles.subCopy}>
          Pick any that apply. You can connect more later from Settings.
        </p>
      </header>
      <div className={styles.optionGridSingle}>
        {APP_OPTIONS.map(option => {
          const isSelected = selectedApps.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              className={`${styles.option} ${
                isSelected ? styles.optionSelected : ''
              }`}
              onClick={() => handleToggle(option.value)}
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
                <span className={styles.optionTitle}>
                  {option.title}
                  {option.comingSoon ? ' · Coming soon' : ''}
                </span>
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
          disabled={disabled}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </>
  );
};
