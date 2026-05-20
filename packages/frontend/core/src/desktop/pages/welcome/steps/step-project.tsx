import { Button } from '@affine/component/ui/button';
import { Input } from '@affine/component/ui/input';
import { useCallback } from 'react';

import * as styles from '../styles.css';

export interface StepProjectProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
  disabled?: boolean;
}

/**
 * Wizard step 5 — "What's your first project?". Free-text input that
 * becomes the title of an extra Project plan starter doc. Pressing
 * the submit button finalises the wizard and creates the workspace.
 *
 * An empty value is allowed: we skip the Project plan doc and just
 * seed the canonical Getting Started doc instead. The submit button
 * stays enabled in that case so the user can finish the wizard
 * without typing something they don't have yet.
 */
export const StepProject = ({
  value,
  onChange,
  onSubmit,
  onBack,
  submitting,
  errorMessage,
  disabled,
}: StepProjectProps) => {
  const handleChange = useCallback(
    (next: string) => {
      onChange(next);
    },
    [onChange]
  );

  return (
    <>
      <header className={styles.greeting}>
        <h1 className={styles.headline}>What&rsquo;s your first project?</h1>
        <p className={styles.subCopy}>
          We&rsquo;ll set up a starter doc for it. You can change or skip — type
          anything that helps you start.
        </p>
      </header>
      <form
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          if (!submitting) {
            onSubmit();
          }
        }}
      >
        <label className={styles.label} htmlFor="welcome-wizard-project">
          Project name
          <Input
            id="welcome-wizard-project"
            autoFocus
            size="large"
            value={value}
            placeholder="e.g. Launch v1.0 of Aurora"
            disabled={submitting || disabled}
            onChange={handleChange}
            onEnter={() => {
              if (!submitting) {
                onSubmit();
              }
            }}
          />
        </label>
        {errorMessage ? (
          <p className={styles.errorText}>{errorMessage}</p>
        ) : null}
        <div className={styles.navRow}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            disabled={submitting || disabled}
          >
            Back
          </button>
          <Button
            variant="primary"
            size="large"
            className={styles.submitButton}
            loading={submitting}
            disabled={submitting || disabled}
            onClick={() => onSubmit()}
          >
            Create my workspace
          </Button>
        </div>
      </form>
    </>
  );
};
