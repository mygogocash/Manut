import { AiOutlineIcon } from '@blocksuite/icons/rc';
import {
  type ChangeEvent,
  type FC,
  useCallback,
  useEffect,
  useState,
} from 'react';

import * as styles from './instructions.css';

export interface InstructionsSectionProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const PLACEHOLDER =
  'e.g. Always answer in formal English. Cite sources from uploaded files.';

export const InstructionsSection: FC<InstructionsSectionProps> = ({
  value,
  onChange,
  disabled,
}) => {
  // Local state for responsive typing; commit to parent on blur or after debounce.
  const [localValue, setLocalValue] = useState(value);

  // Keep local state in sync if parent value changes externally.
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setLocalValue(e.target.value);
    },
    []
  );

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, onChange, value]);

  return (
    <section className={styles.section} aria-labelledby="agent-instructions-heading">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <AiOutlineIcon />
        </span>
        <h3 id="agent-instructions-heading" className={styles.sectionTitle}>
          Instructions
        </h3>
      </div>
      <p className={styles.sectionDescription}>
        Give Computer instructions for how it should work in this space.
      </p>
      <textarea
        className={styles.textarea}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={PLACEHOLDER}
        rows={5}
        aria-label="Agent instructions"
      />
    </section>
  );
};
