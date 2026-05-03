import { FeedViewUI } from './feed-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-feed')) {
    customElements.define('affine-data-view-feed', FeedViewUI);
  }
}
