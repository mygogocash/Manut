import { createIcon } from '../../core/utils/uni-icon.js';
import { chartPreview } from '../previews.js';
import { chartViewModel } from './define.js';
import { ChartViewUILogic } from './pc/chart-view-ui-logic.js';

export const chartViewMeta = chartViewModel.createMeta({
  icon: createIcon('ChartPanelIcon'),
  preview: chartPreview,
  // @ts-expect-error fixme: typesafe
  pcLogic: () => ChartViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => ChartViewUILogic,
});
