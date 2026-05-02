import { createIcon } from '../../core/utils/uni-icon.js';
import { calendarViewModel } from './define.js';
import { CalendarViewUILogic } from './pc/calendar-view-ui-logic.js';

export const calendarViewMeta = calendarViewModel.createMeta({
  // No DatabaseCalendarViewIcon ships in @blocksuite/icons today; DateTimeIcon
  // is the closest visual match. Swap once a Calendar icon lands.
  icon: createIcon('DateTimeIcon'),
  // @ts-expect-error fixme: typesafe — same pattern as kanban/table
  pcLogic: () => CalendarViewUILogic,
  // Mobile logic: defer to follow-up. The view falls back to PC at runtime.
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => CalendarViewUILogic,
});
