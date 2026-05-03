import { TimelineViewUI } from './timeline-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-timeline')) {
    customElements.define('affine-data-view-timeline', TimelineViewUI);
  }
}
