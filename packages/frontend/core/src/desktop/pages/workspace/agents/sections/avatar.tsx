/**
 * AvatarSection — color picker + shuffle for an agent's avatar.
 *
 * The cartoon "Picrew" picker that used to live here was driven by avataaars,
 * which doesn't work on React 19 (legacy childContextTypes API). The renderer
 * is now a deterministic letter+color circle (see components/agent-avatar),
 * so this section is a 10-color palette with a Shuffle button.
 *
 * Backend `AgentAvatarConfig` is stored as free-form JSON; we save the picked
 * color into `value.color`. Older avataaars-shaped configs are left alone —
 * AgentAvatar ignores their string fields and uses the id-hash default until
 * a hex color override is written.
 */

import { UserIcon } from '@blocksuite/icons/rc';
import { type FC, useCallback, useMemo } from 'react';

import {
  AgentAvatar,
  type AgentAvatarConfig,
  LETTER_AVATAR_COLORS,
} from '../../../../../components/agent-avatar';
import * as styles from './avatar.css';

// ---- Public API ------------------------------------------------------------

export interface AvatarSectionProps {
  /** Stable agent id — used for the deterministic default avatar color. */
  agentId: string;
  /** The agent's display name (drives the rendered letter). */
  agentName?: string;
  /** Current persisted avatar config. */
  value: AgentAvatarConfig | null | undefined;
  /** Called whenever the user picks a new color or shuffles. */
  onChange: (next: AgentAvatarConfig) => void;
  disabled?: boolean;
}

// ---- Component -------------------------------------------------------------

export const AvatarSection: FC<AvatarSectionProps> = ({
  agentId,
  agentName,
  value,
  onChange,
  disabled,
}) => {
  // What the preview renders. Spread `value` so any non-color fields the
  // backend already stored (legacy avataaars data) ride along untouched.
  const previewAgent = useMemo(
    () => ({ id: agentId, name: agentName, avatar: value ?? null }),
    [agentId, agentName, value]
  );

  const selectedColor = value?.color;

  const handleSelect = useCallback(
    (color: string) => {
      onChange({ ...value, color });
    },
    [value, onChange]
  );

  const handleShuffle = useCallback(() => {
    // Pick a color other than the current selection so a click always
    // produces a visible change. With only 10 entries this is a fine
    // O(n) filter.
    const others = LETTER_AVATAR_COLORS.filter(c => c !== selectedColor);
    const next =
      others.length > 0
        ? others[Math.floor(Math.random() * others.length)]
        : LETTER_AVATAR_COLORS[
            Math.floor(Math.random() * LETTER_AVATAR_COLORS.length)
          ];
    if (next) onChange({ ...value, color: next });
  }, [value, selectedColor, onChange]);

  const handleReset = useCallback(() => {
    // Drop the manual color so AgentAvatar falls back to the id-hash default.
    if (!value) return;
    const { color: _omit, ...rest } = value;
    onChange(rest);
  }, [value, onChange]);

  return (
    <section className={styles.section} aria-labelledby="agent-avatar-heading">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <UserIcon />
        </span>
        <h3 id="agent-avatar-heading" className={styles.sectionTitle}>
          Avatar
        </h3>
      </div>
      <p className={styles.sectionDescription}>
        Pick a color for this agent. The avatar shows the first letter of the
        name on a colored circle.
      </p>

      <div className={styles.layout}>
        <div className={styles.previewColumn}>
          <div className={styles.preview}>
            <AgentAvatar agent={previewAgent} size={160} bare />
          </div>
          <div className={styles.previewActions}>
            <button
              type="button"
              className={styles.shuffleButton}
              onClick={handleShuffle}
              disabled={disabled}
            >
              Shuffle
            </button>
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
              disabled={disabled || !selectedColor}
            >
              Reset to default
            </button>
          </div>
        </div>

        <div className={styles.editorColumn}>
          <div
            className={styles.optionGrid}
            role="radiogroup"
            aria-label="Avatar color"
          >
            {LETTER_AVATAR_COLORS.map(color => {
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Color ${color}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  className={styles.optionThumb}
                  style={{ background: color }}
                  onClick={() => handleSelect(color)}
                  disabled={disabled}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
