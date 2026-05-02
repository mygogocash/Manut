import { CalendarViewUI } from './calendar-view-ui-logic.js';

export function pcEffects() {
  if (!customElements.get('affine-data-view-calendar')) {
    customElements.define('affine-data-view-calendar', CalendarViewUI);
  }
}
