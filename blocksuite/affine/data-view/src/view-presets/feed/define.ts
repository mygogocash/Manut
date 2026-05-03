import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { FeedSingleView } from './feed-view-manager.js';

export const feedViewType = viewType('feed');
export type FeedViewColumn = { id: string; hide?: boolean };

type DataType = {
  columns: FeedViewColumn[];
  filter: FilterGroup;
  sort?: Sort;
  header: { titleColumn?: string; iconColumn?: string };
  dateRangeFilter?: 'last7days' | 'last30days' | 'alltime'; // α-FEED-2
  pageSize?: number; // α-FEED-1: rows per page, default 50
};

export type FeedViewData = BasicViewDataType<typeof feedViewType.type, DataType>;

export const feedViewModel = feedViewType.createModel<FeedViewData>({
  defaultName: 'Feed View',
  dataViewManager: FeedSingleView,
  defaultData: viewManager => {
    const allProps = viewManager.dataSource.properties$.value;
    const titleColumn = allProps.find(
      id => viewManager.dataSource.propertyTypeGet(id) === 'title'
    );
    return {
      columns: allProps.map(id => ({ id })),
      filter: { type: 'group', op: 'and', conditions: [] },
      header: { titleColumn, iconColumn: 'type' },
      dateRangeFilter: 'alltime',
      pageSize: 50,
    };
  },
});
