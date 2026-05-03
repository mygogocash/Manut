import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { ListSingleView } from './list-view-manager.js';

export const listViewType = viewType('list');

export type ListViewColumn = {
  id: string;
  hide?: boolean;
};

type DataType = {
  columns: ListViewColumn[];
  filter: FilterGroup;
  sort?: Sort;
  header: { titleColumn?: string; iconColumn?: string };
  groupBy?: string; // property id to group by
};

export type ListViewData = BasicViewDataType<typeof listViewType.type, DataType>;

export const listViewModel = listViewType.createModel<ListViewData>({
  defaultName: 'List View',
  dataViewManager: ListSingleView,
  defaultData: viewManager => {
    const allProps = viewManager.dataSource.properties$.value;
    const titleColumn = allProps.find(
      id => viewManager.dataSource.propertyTypeGet(id) === 'title'
    );
    return {
      columns: allProps.map(id => ({ id })),
      filter: { type: 'group', op: 'and', conditions: [] },
      header: { titleColumn, iconColumn: 'type' },
    };
  },
});
