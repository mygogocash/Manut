import type { FilterGroup } from '../../core/filter/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { DashboardSingleView } from './dashboard-view-manager.js';

export const dashboardViewType = viewType('dashboard');

// Each cell in the dashboard grid
export type DashboardCell = {
  id: string;
  type: 'chart' | 'summary' | 'table';
  // Grid position (12-column grid)
  x: number;
  y: number;
  w: number; // in grid units
  h: number; // in grid units
  // Config for chart cell
  chartSpec?: string; // JSON vega-lite spec
  chartType?: 'bar' | 'line' | 'pie';
  xAxisColumnId?: string;
  yAxisColumnIds?: string[];
  // Config for summary cell
  summaryType?: 'count' | 'sum' | 'avg' | 'last-edited';
  summaryColumnId?: string;
  title?: string;
};

type DataType = {
  filter: FilterGroup;
  cells: DashboardCell[];
  gridCols?: number; // default 12
};

export type DashboardViewData = BasicViewDataType<
  typeof dashboardViewType.type,
  DataType
>;

export const dashboardViewModel = dashboardViewType.createModel<DashboardViewData>({
  defaultName: 'Dashboard',
  dataViewManager: DashboardSingleView,
  defaultData: () => ({
    filter: { type: 'group', op: 'and', conditions: [] },
    cells: [],
    gridCols: 12,
  }),
});
