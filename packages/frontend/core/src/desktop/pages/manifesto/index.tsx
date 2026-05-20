/**
 * /manifesto — Manut brand easter egg.
 *
 * Wave 2 B12 / M3 E3.4 brand polish. Lush typography (Source Serif 4
 * display, Inter body — both already wired in `fonts.css`), subtle
 * scroll-friendly gradient background, short manifesto verse about
 * the Manut vision. Linked from no nav surface — the surface is
 * intentionally discoverable only by URL ("easter egg" per the
 * IMPLEMENTATION_PLAN.md §B12 spec).
 *
 * Future evolution: when a real variable display face is wired up
 * (see fonts.css TODO for `--manut-font-display`), swap Source
 * Serif 4 → that face. The token already points the right way; the
 * font-family literals here are belt-and-brace fallbacks.
 */

import type { MouseEvent } from 'react';
import { useCallback, useEffect } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';
import * as styles from './styles.css';

/**
 * The verse — eight lines, deliberate, brand-philosophical. Tone:
 * confident but not bombastic. We keep this terse on purpose; the
 * page is a love letter, not a sales deck.
 */
const MANUT_VERSES: ReadonlyArray<string> = [
  'A workspace remembers what you forget.',
  'Tools shape thought; thought shapes the tool back.',
  'The page is alive. So is the cursor.',
  'Calm software is louder than busy software.',
  'Software that listens is software that lasts.',
  'Make the next thought easier than the last.',
  'A doc is a small machine for thinking together.',
  'Build with patience. Ship with conviction.',
];

export const ManutManifestoPage = () => {
  const { jumpToIndex } = useNavigateHelper();

  // Set the document title so the tab reads cleanly when the page
  // is shared. The router itself doesn't manage <head> on every
  // route, so we patch on mount and restore on unmount.
  useEffect(() => {
    const previous = document.title;
    document.title = 'Manifesto · Manut';
    return () => {
      document.title = previous;
    };
  }, []);

  const handleHome = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      jumpToIndex(RouteLogic.PUSH);
    },
    [jumpToIndex]
  );

  return (
    <div className={styles.root} data-testid="manut-manifesto">
      <article className={styles.article}>
        <p className={styles.eyebrow}>Manifesto · v1</p>
        <h1 className={styles.headline}>What we&rsquo;re really building.</h1>
        <p className={styles.body}>
          Manut is a workspace for people who care about how they think — not
          just what they ship. We&rsquo;re building it slowly, on purpose, in
          the open.
        </p>
        <ul className={styles.verseList}>
          {MANUT_VERSES.map((line, idx) => (
            <li key={idx} className={styles.verse}>
              {line}
            </li>
          ))}
        </ul>
        <p className={styles.signature}>— The Manut Team</p>
        <a href="/" onClick={handleHome} className={styles.homeLink}>
          Return to your workspace →
        </a>
      </article>
    </div>
  );
};

export const Component = () => {
  return <ManutManifestoPage />;
};
