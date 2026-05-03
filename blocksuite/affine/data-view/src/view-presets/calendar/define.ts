import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { CalendarSingleView } from './calendar-view-manager.js';

export const calendarViewType = viewType('calendar');

export type CalendarViewColumn = {
  id: string;
  hide?: boolean;
};

type DataType = {
  /**
   * Property id of the date column that drives row positioning.
   * Required at runtime; the view falls back to today if the row's value is missing.
   */
  dateColumnId?: string;

  /** Property ids displayed inside each event card (titleColumn first, then these). */
  columns: CalendarViewColumn[];

  filter: FilterGroup;
  sort?: Sort;

  header: {
    titleColumn?: string;
    iconColumn?: string;
  };

  /**
   * Display mode. MVP only ships `month`; week/day are placeholders for future work.
   */
  displayMode?: 'month' | 'week' | 'day';

  /**
   * Optional property id of a second date column used as the end date for multi-day event spans.
   * When set, rows with both a start (dateColumnId) and an end date are rendered as
   * horizontal bars spanning all day cells between startDay and endDay in month view.
   */
  endDateColumnId?: string;
};

export type CalendarViewData = BasicViewDataType<
  typeof calendarViewType.type,
  DataType
>;

export const calendarViewModel = calendarViewType.createModel<CalendarViewData>(
  {
    defaultName: 'Calendar View',
    dataViewManager: CalendarSingleView,
    defaultData: viewManager => {
      const allProps = viewManager.dataSource.properties$.value;

      const titleColumn = allProps.find(
        id => viewManager.dataSource.propertyTypeGet(id) === 'title'
      );

      // Pick the first date-typed property as the calendar axis.
      // If none exists, the view will degrade gracefully — every row lands on "today".
      const dateColumn = allProps.find(
        id => viewManager.dataSource.propertyTypeGet(id) === 'date'
      );

      return {
        dateColumnId: dateColumn,
        columns: allProps.map(id => ({ id })),
        filter: { type: 'group', op: 'and', conditions: [] },
        header: {
          titleColumn,
          iconColumn: 'type',
        },
        displayMode: 'month',
      };
    },
  }
);
