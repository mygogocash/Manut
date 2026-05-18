import { style } from '@vanilla-extract/css';

/**
 * GraphMini is a 60x24 canvas that lives in the sidebar header next to
 * the workspace switcher. It carries the Knowledge Graph aesthetic into
 * every page as ambient brand — three nodes connected by two faint
 * arcs, and a bright synaptic pulse runs along an arc whenever an AI
 * doc-read activation fires on the bus.
 *
 * Sized for header density: 60w x 24h, transparent background so the
 * parent's surface shows through. `pointerEvents: none` because it's
 * purely decorative — clicks pass through to whatever is behind it.
 */
export const canvas = style({
  width: 60,
  height: 24,
  pointerEvents: 'none',
  display: 'block',
  flexShrink: 0,
});
