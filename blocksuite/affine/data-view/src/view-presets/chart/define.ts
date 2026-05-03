import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { ChartSingleView } from './chart-view-manager.js';

export const chartViewType = viewType('chart');

export type ChartViewColumn = {
  id: string;
  hide?: boolean;
};

type DataType = {
  columns: ChartViewColumn[];
  filter: FilterGroup;
  sort?: Sort;
  header: {
    titleColumn?: string;
    iconColumn?: string;
  };
  chartType: 'bar' | 'line' | 'pie';
  /** Property id for x-axis (grouping). */
  xAxisColumnId?: string;
  /** α-CHART-3: multiple y-axis properties. */
  yAxisColumnIds?: string[];
};

export type ChartViewData = BasicViewDataType<
  typeof chartViewType.type,
  DataType
>;

export const chartViewModel = chartViewType.createModel<ChartViewData>({
  defaultName: 'Chart View',
  dataViewManager: ChartSingleView,
  defaultData: viewManager => {
    const allProps = viewManager.dataSource.properties$.value;

    const titleColumn = allProps.find(
      id => viewManager.dataSource.propertyTypeGet(id) === 'title'
    );

    return {
      columns: allProps.map(id => ({ id })),
      filter: { type: 'group', op: 'and', conditions: [] },
      header: {
        titleColumn,
        iconColumn: 'type',
      },
      chartType: 'bar',
      yAxisColumnIds: [],
    };
  },
});
