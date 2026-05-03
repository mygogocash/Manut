import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { GallerySingleView } from './gallery-view-manager.js';

export const galleryViewType = viewType('gallery');
export type GalleryViewColumn = { id: string; hide?: boolean };

type DataType = {
  columns: GalleryViewColumn[];
  filter: FilterGroup;
  sort?: Sort;
  header: { titleColumn?: string; iconColumn?: string };
  coverImageColumnId?: string; // property used for card cover image
  cardSize?: 'sm' | 'md' | 'lg'; // α-GAL-2
};

export type GalleryViewData = BasicViewDataType<
  typeof galleryViewType.type,
  DataType
>;

export const galleryViewModel = galleryViewType.createModel<GalleryViewData>({
  defaultName: 'Gallery View',
  dataViewManager: GallerySingleView,
  defaultData: viewManager => {
    const allProps = viewManager.dataSource.properties$.value;
    const titleColumn = allProps.find(
      id => viewManager.dataSource.propertyTypeGet(id) === 'title'
    );
    return {
      columns: allProps.map(id => ({ id })),
      filter: { type: 'group', op: 'and', conditions: [] },
      header: { titleColumn, iconColumn: 'type' },
      cardSize: 'md',
    };
  },
});
