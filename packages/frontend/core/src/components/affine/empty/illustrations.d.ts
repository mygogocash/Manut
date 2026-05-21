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
/**
 * Empty docs: a stack of layered "document" cards with hint lines.
 * Communicates "no documents yet — create one".
 */
export declare const EmptyDocsIllustration: ({ size, style, className, }: IllustrationProps) => import("react/jsx-runtime").JSX.Element;
/**
 * Empty collections (list of groups): a 2x2 grid of squares with one
 * "ghost" plus-marker tile in the bottom-right.
 * Communicates "no collections — add one".
 */
export declare const EmptyCollectionsIllustration: ({ size, style, className, }: IllustrationProps) => import("react/jsx-runtime").JSX.Element;
/**
 * Empty collection detail (a collection exists but has no docs/rules):
 * a tile with a stacked "card-inside" + a small funnel/filter glyph above.
 * Communicates "this collection has no docs — add one or define a rule".
 */
export declare const EmptyCollectionDetailIllustration: ({ size, style, className, }: IllustrationProps) => import("react/jsx-runtime").JSX.Element;
/**
 * Empty tags: three pill/tag shapes at slightly varied widths + colors,
 * arranged in a casual diagonal.
 * Communicates "no tags yet".
 */
export declare const EmptyTagsIllustration: ({ size, style, className, }: IllustrationProps) => import("react/jsx-runtime").JSX.Element;
/**
 * Empty / denied state (access denied or feature not available):
 * a closed box with a faint diagonal stroke through it.
 * Kept around for future use even though no current consumer references it.
 */
export declare const EmptyDeniedIllustration: ({ size, style, className, }: IllustrationProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=illustrations.d.ts.map