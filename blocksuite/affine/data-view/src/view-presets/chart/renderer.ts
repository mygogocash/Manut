import { createIcon } from '../../core/utils/uni-icon.js';
import { chartViewModel } from './define.js';
import { ChartViewUILogic } from './pc/chart-view-ui-logic.js';

export const chartViewMeta = chartViewModel.createMeta({
  icon: createIcon('DatabaseKanbanViewIcon'),
  // @ts-expect-error fixme: typesafe
  pcLogic: () => ChartViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => ChartViewUILogic,
});
