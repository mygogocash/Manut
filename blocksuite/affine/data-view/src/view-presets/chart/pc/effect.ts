import { ChartViewUI } from './chart-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-chart')) {
    customElements.define('affine-data-view-chart', ChartViewUI);
  }
}
