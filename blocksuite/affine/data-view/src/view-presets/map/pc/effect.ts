import { MapViewUI } from './map-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-map')) {
    customElements.define('affine-data-view-map', MapViewUI);
  }
}
