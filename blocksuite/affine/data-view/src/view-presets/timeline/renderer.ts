import { createIcon } from '../../core/utils/uni-icon.js';
import { timelinePreview } from '../previews.js';
import { timelineViewModel } from './define.js';
import { TimelineViewUILogic } from './pc/timeline-view-ui-logic.js';

export const timelineViewMeta = timelineViewModel.createMeta({
  icon: createIcon('TimelineIcon'),
  preview: timelinePreview,
  // @ts-expect-error fixme: typesafe
  pcLogic: () => TimelineViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => TimelineViewUILogic,
});
