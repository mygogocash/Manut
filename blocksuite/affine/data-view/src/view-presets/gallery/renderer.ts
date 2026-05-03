import { createIcon } from '../../core/utils/uni-icon.js';
import { galleryViewModel } from './define.js';
import { GalleryViewUILogic } from './pc/gallery-view-ui-logic.js';

export const galleryViewMeta = galleryViewModel.createMeta({
  icon: createIcon('FrameIcon'),
  // @ts-expect-error fixme: typesafe
  pcLogic: () => GalleryViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => GalleryViewUILogic,
});
