import { style } from '@vanilla-extract/css';

/**
 * Accessibility affordances for the Knowledge Graph canvas (M15).
 *
 * The graph itself is painted on a `<canvas>` — opaque to assistive tech.
 * To make the same content keyboard- and screen-reader-navigable we render
 * a visually-hidden but focusable list of the docs alongside the canvas.
 * Activating an item opens the same NodeDetailPanel a canvas click opens.
 *
 * Styles live here (a `.css.ts`) rather than inline because the sr-only +
 * focus-reveal behaviour needs `:focus-visible`, which inline `style={}`
 * can't express.
 */

/**
 * Standard visually-hidden ("sr-only") block — present in the accessibility
 * tree and focus order, clipped out of the visual layout. Used for the live
 * summary text and as the wrapper for the focusable doc list.
 */
export const visuallyHidden = style({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});

export const a11yList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

/**
 * A focusable doc entry. Inherits the sr-only clipping from its wrapper, but
 * when focused via keyboard it un-clips and surfaces a visible focus ring so
 * a sighted keyboard user can see where they are in the graph.
 */
export const a11yItem = style({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&:focus-visible': {
      position: 'fixed',
      top: 8,
      left: 8,
      zIndex: 10,
      width: 'auto',
      height: 'auto',
      clip: 'auto',
      margin: 0,
      padding: '6px 12px',
      borderRadius: 6,
      background: 'var(--affine-background-overlay-panel-color, #1c1c22)',
      color: 'var(--affine-text-primary-color, #fff)',
      outline: '2px solid var(--affine-primary-color, #1e96eb)',
      outlineOffset: 2,
      whiteSpace: 'nowrap',
    },
  },
});
