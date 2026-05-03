import { createIcon } from '../../core/utils/uni-icon.js';
import { feedPreview } from '../previews.js';
import { feedViewModel } from './define.js';
import { FeedViewUILogic } from './pc/feed-view-ui-logic.js';

export const feedViewMeta = feedViewModel.createMeta({
  icon: createIcon('BulletedListIcon'),
  preview: feedPreview,
  // @ts-expect-error fixme: typesafe
  pcLogic: () => FeedViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => FeedViewUILogic,
});
