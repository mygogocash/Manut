import { createIcon } from '../../core/utils/uni-icon.js';
import { timelineViewModel } from './define.js';
import { TimelineViewUILogic } from './pc/timeline-view-ui-logic.js';

export const timelineViewMeta = timelineViewModel.createMeta({
  icon: createIcon('FrameIcon'),
  // @ts-expect-error fixme: typesafe
  pcLogic: () => TimelineViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => TimelineViewUILogic,
});
