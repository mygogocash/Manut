import type { ViewMeta } from '@blocksuite/data-view';
import { viewConverts, viewPresets } from '@blocksuite/data-view/view-presets';

// All view presets registered with the database block. The "View settings"
// layout switcher in the database UI enumerates from this array — so adding
// a preset here makes it selectable as a layout for any database table.
//
// Order matters for the picker layout. Group canonical views (table, kanban,
// calendar) first, then list-style views, then visual / spatial views.
export const databaseBlockViews: ViewMeta[] = [
  viewPresets.tableViewMeta,
  viewPresets.kanbanViewMeta,
  viewPresets.calendarViewMeta,
  viewPresets.timelineViewMeta,
  viewPresets.listViewMeta,
  viewPresets.feedViewMeta,
  viewPresets.galleryViewMeta,
  viewPresets.formViewMeta,
  viewPresets.chartViewMeta,
  viewPresets.dashboardViewMeta,
  viewPresets.mapViewMeta,
];

export const databaseBlockViewMap = Object.fromEntries(
  databaseBlockViews.map(view => [view.type, view])
);
export const databaseBlockViewConverts = [...viewConverts];
