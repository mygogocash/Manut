import { GalleryViewUI } from './gallery-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-gallery')) {
    customElements.define('affine-data-view-gallery', GalleryViewUI);
  }
}
