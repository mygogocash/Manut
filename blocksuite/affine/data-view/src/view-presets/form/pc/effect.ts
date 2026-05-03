import { FormViewUI } from './form-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-form')) {
    customElements.define('affine-data-view-form', FormViewUI);
  }
}
