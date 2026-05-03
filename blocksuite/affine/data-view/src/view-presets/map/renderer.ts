import { createIcon } from '../../core/utils/uni-icon.js';
import { mapViewModel } from './define.js';
import { MapViewUILogic } from './pc/map-view-ui-logic.js';

export const mapViewMeta = mapViewModel.createMeta({
  icon: createIcon('FrameIcon'),
  // @ts-expect-error fixme: typesafe — same pattern as kanban/table
  pcLogic: () => MapViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => MapViewUILogic,
});
