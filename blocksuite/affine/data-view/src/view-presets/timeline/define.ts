import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { TimelineSingleView } from './timeline-view-manager.js';

export const timelineViewType = viewType('timeline');
export type TimelineViewColumn = { id: string; hide?: boolean };

type DataType = {
  columns: TimelineViewColumn[];
  filter: FilterGroup;
  sort?: Sort;
  header: { titleColumn?: string; iconColumn?: string };
  startDateColumnId?: string; // property for bar start
  endDateColumnId?: string; // α-TL-2: property for bar end
  dependencyColumnId?: string; // α-TL-3: relation/text property for dependencies
  zoomLevel?: 'week' | 'month' | 'quarter' | 'year'; // α-TL-4
  viewStartDate?: number; // epoch ms of left edge of viewport
};

export type TimelineViewData = BasicViewDataType<
  typeof timelineViewType.type,
  DataType
>;

export const timelineViewModel =
  timelineViewType.createModel<TimelineViewData>({
    defaultName: 'Timeline View',
    dataViewManager: TimelineSingleView,
    defaultData: viewManager => {
      const allProps = viewManager.dataSource.properties$.value;
      const titleColumn = allProps.find(
        id => viewManager.dataSource.propertyTypeGet(id) === 'title'
      );
      const dateColumn = allProps.find(
        id => viewManager.dataSource.propertyTypeGet(id) === 'date'
      );
      return {
        columns: allProps.map(id => ({ id })),
        filter: { type: 'group', op: 'and', conditions: [] },
        header: { titleColumn, iconColumn: 'type' },
        startDateColumnId: dateColumn,
        zoomLevel: 'month',
        viewStartDate: Date.now() - 7 * 86400000, // start 1 week ago
      };
    },
  });
