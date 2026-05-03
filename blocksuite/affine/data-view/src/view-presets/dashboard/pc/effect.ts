import { DashboardViewUI } from './dashboard-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-dashboard')) {
    customElements.define('affine-data-view-dashboard', DashboardViewUI);
  }
}
