/**
 * Manut empty-state illustrations.
 *
 * Each illustration is a pure-SVG component that themes via `currentColor`
 * and layered opacity. They replace the inherited PNG pairs (light/dark)
 * with single themeable assets — ~1-2KB each gzipped vs ~20-50KB per PNG
 * pair, with no theme-swap flicker.
 *
 * Visual language:
 *   - 120x120 viewBox, ~300px rendered (matches `styles.illustration` width).
 *   - Geometric forms only — stacked rectangles, dotted grids, circles.
 *   - Opacity ramp: 0.08 (deepest layer) -> 0.18 -> 0.32 (foreground card).
 *   - Stroke weight 1.25 with `currentColor` + `strokeOpacity` for outlines.
 *   - No hand-drawn whimsy; productivity-app aesthetic.
 *
 * Inherit color from a parent setting `color` (e.g. text/primary or
 * text/secondary cssVarV2 token). Default flow uses the parent paragraph
 * color, which is fine on both themes because we only use opacity.
 */

import type { CSSProperties } from 'react';

export interface IllustrationProps {
  /** Pixel size (square). Defaults to 120. */
  size?: number | string;
  /** Forwarded to wrapping <svg> for layout overrides. */
  style?: CSSProperties;
  className?: string;
}

const SVG_DEFAULTS = {
  viewBox: '0 0 120 120',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
};

/**
 * Empty docs: a stack of layered "document" cards with hint lines.
 * Communicates "no documents yet — create one".
 */
export const EmptyDocsIllustration = ({
  size = 120,
  style,
  className,
}: IllustrationProps) => (
  <svg
    {...SVG_DEFAULTS}
    width={size}
    height={size}
    style={style}
    className={className}
  >
    {/* Layered cards (back to front) */}
    <rect
      x="22"
      y="18"
      width="58"
      height="76"
      rx="6"
      fill="currentColor"
      opacity="0.08"
    />
    <rect
      x="30"
      y="24"
      width="58"
      height="76"
      rx="6"
      fill="currentColor"
      opacity="0.16"
    />
    <rect
      x="38"
      y="30"
      width="58"
      height="76"
      rx="6"
      fill="currentColor"
      opacity="0.28"
      stroke="currentColor"
      strokeOpacity="0.55"
      strokeWidth="1.25"
    />
    {/* Hint text lines on the foreground card */}
    <line
      x1="46"
      y1="48"
      x2="84"
      y2="48"
      stroke="currentColor"
      strokeOpacity="0.5"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="46"
      y1="60"
      x2="76"
      y2="60"
      stroke="currentColor"
      strokeOpacity="0.35"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="46"
      y1="72"
      x2="82"
      y2="72"
      stroke="currentColor"
      strokeOpacity="0.35"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="46"
      y1="84"
      x2="70"
      y2="84"
      stroke="currentColor"
      strokeOpacity="0.25"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Empty collections (list of groups): a 2x2 grid of squares with one
 * "ghost" plus-marker tile in the bottom-right.
 * Communicates "no collections — add one".
 */
export const EmptyCollectionsIllustration = ({
  size = 120,
  style,
  className,
}: IllustrationProps) => (
  <svg
    {...SVG_DEFAULTS}
    width={size}
    height={size}
    style={style}
    className={className}
  >
    {/* Top-left tile */}
    <rect
      x="22"
      y="22"
      width="34"
      height="34"
      rx="6"
      fill="currentColor"
      opacity="0.28"
      stroke="currentColor"
      strokeOpacity="0.55"
      strokeWidth="1.25"
    />
    {/* Top-right tile */}
    <rect
      x="64"
      y="22"
      width="34"
      height="34"
      rx="6"
      fill="currentColor"
      opacity="0.18"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.25"
    />
    {/* Bottom-left tile */}
    <rect
      x="22"
      y="64"
      width="34"
      height="34"
      rx="6"
      fill="currentColor"
      opacity="0.18"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.25"
    />
    {/* Bottom-right "ghost" plus tile */}
    <rect
      x="64"
      y="64"
      width="34"
      height="34"
      rx="6"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.25"
      strokeDasharray="3 3"
    />
    <line
      x1="81"
      y1="74"
      x2="81"
      y2="88"
      stroke="currentColor"
      strokeOpacity="0.65"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="74"
      y1="81"
      x2="88"
      y2="81"
      stroke="currentColor"
      strokeOpacity="0.65"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Empty collection detail (a collection exists but has no docs/rules):
 * a tile with a stacked "card-inside" + a small funnel/filter glyph above.
 * Communicates "this collection has no docs — add one or define a rule".
 */
export const EmptyCollectionDetailIllustration = ({
  size = 120,
  style,
  className,
}: IllustrationProps) => (
  <svg
    {...SVG_DEFAULTS}
    width={size}
    height={size}
    style={style}
    className={className}
  >
    {/* Outer collection tile */}
    <rect
      x="22"
      y="26"
      width="76"
      height="76"
      rx="8"
      fill="currentColor"
      opacity="0.08"
    />
    <rect
      x="22"
      y="26"
      width="76"
      height="76"
      rx="8"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.5"
      strokeWidth="1.25"
    />
    {/* Inner empty card placeholder */}
    <rect
      x="38"
      y="50"
      width="44"
      height="38"
      rx="5"
      fill="currentColor"
      opacity="0.22"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.25"
      strokeDasharray="3 3"
    />
    {/* Filter funnel glyph (top center) */}
    <path
      d="M52 16 H68 L62 24 V32 L58 30 V24 Z"
      fill="currentColor"
      opacity="0.55"
    />
  </svg>
);

/**
 * Empty tags: three pill/tag shapes at slightly varied widths + colors,
 * arranged in a casual diagonal.
 * Communicates "no tags yet".
 */
export const EmptyTagsIllustration = ({
  size = 120,
  style,
  className,
}: IllustrationProps) => (
  <svg
    {...SVG_DEFAULTS}
    width={size}
    height={size}
    style={style}
    className={className}
  >
    {/* Tag pill 1 (top) */}
    <rect
      x="18"
      y="34"
      width="58"
      height="16"
      rx="8"
      fill="currentColor"
      opacity="0.28"
      stroke="currentColor"
      strokeOpacity="0.55"
      strokeWidth="1.25"
    />
    <circle cx="28" cy="42" r="2.5" fill="currentColor" opacity="0.7" />
    {/* Tag pill 2 (middle) */}
    <rect
      x="32"
      y="56"
      width="70"
      height="16"
      rx="8"
      fill="currentColor"
      opacity="0.18"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.25"
    />
    <circle cx="42" cy="64" r="2.5" fill="currentColor" opacity="0.55" />
    {/* Tag pill 3 (bottom) */}
    <rect
      x="22"
      y="78"
      width="48"
      height="16"
      rx="8"
      fill="currentColor"
      opacity="0.18"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.25"
    />
    <circle cx="32" cy="86" r="2.5" fill="currentColor" opacity="0.55" />
  </svg>
);

/**
 * Empty / denied state (access denied or feature not available):
 * a closed box with a faint diagonal stroke through it.
 * Kept around for future use even though no current consumer references it.
 */
export const EmptyDeniedIllustration = ({
  size = 120,
  style,
  className,
}: IllustrationProps) => (
  <svg
    {...SVG_DEFAULTS}
    width={size}
    height={size}
    style={style}
    className={className}
  >
    {/* Locked card */}
    <rect
      x="28"
      y="32"
      width="64"
      height="56"
      rx="6"
      fill="currentColor"
      opacity="0.18"
      stroke="currentColor"
      strokeOpacity="0.5"
      strokeWidth="1.25"
    />
    {/* Padlock body */}
    <rect
      x="50"
      y="56"
      width="20"
      height="18"
      rx="2"
      fill="currentColor"
      opacity="0.55"
    />
    {/* Padlock shackle */}
    <path
      d="M54 56 V50 a6 6 0 0 1 12 0 V56"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.65"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);
