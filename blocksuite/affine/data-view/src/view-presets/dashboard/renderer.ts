import { createIcon } from '../../core/utils/uni-icon.js';
import { dashboardPreview } from '../previews.js';
import { dashboardViewModel } from './define.js';
import { DashboardViewUILogic } from './pc/dashboard-view-ui-logic.js';

export const dashboardViewMeta = dashboardViewModel.createMeta({
  icon: createIcon('LayoutIcon'),
  preview: dashboardPreview,
  // @ts-expect-error fixme: typesafe
  pcLogic: () => DashboardViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => DashboardViewUILogic,
});
