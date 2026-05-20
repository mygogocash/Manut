/**
 * Manut animated loading screen.
 *
 * Wave 2 B12 / M3 E3.4 brand polish. Centered, fades in over
 * `--affine-anim-duration-slow`, shows the Manut wordmark with a subtle
 * letter-by-letter rise, and a muted "Loading…" subtitle that pulses.
 *
 * Pure CSS animation — no framer-motion dep. The parallel E2.7 work
 * ships framer-motion presets and we don't want to fight that import
 * graph here. Plain keyframes also keep this safe to mount BEFORE the
 * React tree (some entry-points show a loading state before the full
 * app is hydrated).
 *
 * Toast styling note: the Manut brand toast shape already lives in
 * `packages/frontend/component/src/ui/notification/desktop/styles.css.ts`
 * (radius=card, surface-glass-strong, blur+saturate). That file was
 * branded as part of an earlier Wave 1/2 commit, so we don't restyle
 * the toast here — the §6c "deferred rename items" rule applies: if
 * it's already done, don't touch.
 */

import type { ReactElement } from 'react';

import * as styles from './loading-screen.css';

const MANUT_GLYPHS: ReadonlyArray<string> = ['M', 'a', 'n', 'u', 't'];

export interface ManutLoadingScreenProps {
  /**
   * Optional subtitle text. Defaults to a plain English "Loading…"
   * literal — i18n is intentionally NOT wired so this stays mountable
   * before locale resources are ready (some entry-points render this
   * pre-hydration). Pass a translated string from the call site if
   * you need it localised.
   */
  subtitle?: string;
}

/**
 * Renders the animated brand loading screen. Mount it as the topmost
 * sibling — it positions `fixed` over the viewport — and unmount once
 * the deferred work has resolved.
 */
export const ManutLoadingScreen = ({
  subtitle = 'Loading…',
}: ManutLoadingScreenProps): ReactElement => {
  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      aria-label="Loading Manut"
      data-testid="manut-loading-screen"
    >
      <h1 className={styles.wordmark} aria-hidden="true">
        {MANUT_GLYPHS.map((glyph, idx) => (
          <span key={`${glyph}-${idx}`} className={styles.wordmarkGlyph}>
            {glyph}
          </span>
        ))}
      </h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  );
};

export default ManutLoadingScreen;
