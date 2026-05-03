import {
  menu,
  popFilterableSimpleMenu,
  type PopupTarget,
} from '@blocksuite/affine-components/context-menu';
import {
  CopyIcon,
  DeleteIcon,
  ExpandFullIcon,
  MoveLeftIcon,
  MoveRightIcon,
} from '@blocksuite/icons/lit';
import { html } from 'lit';

import { TableViewRowSelection } from '../selection';
import { autofillRow } from './ai-autofill.js';
import type { TableSelectionController } from './controller/selection.js';
import type { TableViewUILogic } from './table-view-ui-logic.js';

// Inline sparkle icon for AI autofill — avoids hard dependency on icon packages.
const AiSparkleIcon = () => html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="16"
  height="16"
  viewBox="0 0 20 20"
  fill="currentColor"
>
  <path
    d="M10 2.5L11.55 7.45L16.5 9L11.55 10.55L10 15.5L8.45 10.55L3.5 9L8.45 7.45L10 2.5Z"
  />
  <path
    d="M15.5 14L16.25 16.25L18.5 17L16.25 17.75L15.5 20L14.75 17.75L12.5 17L14.75 16.25L15.5 14Z"
  />
  <path
    d="M4.5 1L5.25 3.25L7.5 4L5.25 4.75L4.5 7L3.75 4.75L1.5 4L3.75 3.25L4.5 1Z"
  />
</svg>`;

export const openDetail = (
  tableViewLogic: TableViewUILogic,
  rowId: string,
  selection: TableSelectionController
) => {
  const old = selection.selection;
  selection.selection = undefined;
  tableViewLogic.root.openDetailPanel({
    view: selection.logic.view,
    rowId: rowId,
    onClose: () => {
      selection.selection = old;
    },
  });
};

export const popRowMenu = (
  tableViewLogic: TableViewUILogic,
  ele: PopupTarget,
  selectionController: TableSelectionController
) => {
  const selection = selectionController.selection;
  if (!TableViewRowSelection.is(selection)) {
    return;
  }
  if (selection.rows.length > 1) {
    const rows = TableViewRowSelection.rowsIds(selection);
    popFilterableSimpleMenu(ele, [
      menu.group({
        name: '',
        items: [
          menu.action({
            name: 'Copy',
            prefix: html` <div
              style="transform: rotate(90deg);display:flex;align-items:center;"
            >
              ${CopyIcon()}
            </div>`,
            select: () => {
              selectionController.logic.clipboardController.copy();
            },
          }),
        ],
      }),
      menu.group({
        name: '',
        items: [
          menu.action({
            name: 'Delete Rows',
            class: {
              'delete-item': true,
            },
            prefix: DeleteIcon(),
            select: () => {
              selectionController.view.rowsDelete(rows);
              selectionController.logic.ui$.value?.requestUpdate();
            },
          }),
        ],
      }),
    ]);
    return;
  }
  const row = selection.rows[0];
  if (!row) return;

  const aiAutofill = tableViewLogic.root.config.aiAutofill;
  const view = selectionController.view;
  const notification = tableViewLogic.root.config.notification;

  popFilterableSimpleMenu(ele, [
    menu.action({
      name: 'Expand Row',
      prefix: ExpandFullIcon(),
      select: () => {
        openDetail(tableViewLogic, row.id, selectionController);
      },
    }),
    // β-AI-6: Auto-fill empty cells with AI (only shown when AI is available)
    menu.group({
      name: '',
      items: [
        menu.action({
          name: '✨ Auto-fill empty cells with AI',
          prefix: AiSparkleIcon(),
          hide: () => aiAutofill == null,
          select: () => {
            if (!aiAutofill) return;
            notification.toast('Filling empty cells with AI…');
            autofillRow(view, row.id, aiAutofill, (filled, total) => {
              if (filled === total) {
                notification.toast(
                  `${filled} cell${filled !== 1 ? 's' : ''} filled by AI`
                );
              }
            }).catch((err: unknown) => {
              console.error('[AI autofill row] failed', err);
              notification.toast('AI autofill failed. Please try again.');
            });
          },
        }),
      ],
    }),
    menu.group({
      name: '',
      items: [
        menu.action({
          name: 'Insert Before',
          prefix: html` <div
            style="transform: rotate(90deg);display:flex;align-items:center;"
          >
            ${MoveLeftIcon()}
          </div>`,
          select: () => {
            selectionController.insertRowBefore(row.groupKey, row.id);
          },
        }),
        menu.action({
          name: 'Insert After',
          prefix: html` <div
            style="transform: rotate(90deg);display:flex;align-items:center;"
          >
            ${MoveRightIcon()}
          </div>`,
          select: () => {
            selectionController.insertRowAfter(row.groupKey, row.id);
          },
        }),
      ],
    }),
    menu.group({
      items: [
        menu.action({
          name: 'Delete Row',
          class: { 'delete-item': true },
          prefix: DeleteIcon(),
          select: () => {
            selectionController.deleteRow(row.id);
          },
        }),
      ],
    }),
  ]);
};
