import { ListViewUI } from './list-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-list')) {
    customElements.define('affine-data-view-list', ListViewUI);
  }
}
