import { createIcon } from '../../core/utils/uni-icon.js';
import { kanbanPreview } from '../previews.js';
import { kanbanViewModel } from './define.js';
import { MobileKanbanViewUILogic } from './mobile/kanban-view-ui-logic.js';
import { KanbanViewUILogic } from './pc/kanban-view-ui-logic.js';

export const kanbanViewMeta = kanbanViewModel.createMeta({
  icon: createIcon('DatabaseKanbanViewIcon'),
  preview: kanbanPreview,
  // @ts-expect-error fixme: typesafe
  pcLogic: () => KanbanViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => MobileKanbanViewUILogic,
});
