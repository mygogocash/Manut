import { calendarEffects } from './calendar/effect.js';
import { chartEffects } from './chart/effect.js';
import { dashboardEffects } from './dashboard/effect.js';
import { feedEffects } from './feed/effect.js';
import { formEffects } from './form/effect.js';
import { galleryEffects } from './gallery/effect.js';
import { kanbanEffects } from './kanban/effect.js';
import { listEffects } from './list/effect.js';
import { mapEffects } from './map/effect.js';
import { tableEffects } from './table/effect.js';
import { timelineEffects } from './timeline/effect.js';

export function viewPresetsEffects() {
  kanbanEffects();
  tableEffects();
  calendarEffects();
  dashboardEffects();
  chartEffects();
  galleryEffects();
  feedEffects();
  listEffects();
  formEffects();
  timelineEffects();
  mapEffects();
}
