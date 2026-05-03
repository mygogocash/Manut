import {
  menu,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import {
  DeleteIcon,
  DuplicateIcon,
  FilterIcon,
  InsertLeftIcon,
  InsertRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  SortIcon,
  ViewIcon,
} from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { css } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import { autofillColumn } from '../ai-autofill.js';

import {
  inputConfig,
  typeConfig,
} from '../../../../core/common/property-menu.js';
import { filterTraitKey } from '../../../../core/filter/trait.js';
import { firstFilterByRef } from '../../../../core/filter/utils.js';
import { renderUniLit } from '../../../../core/index.js';
import { sortTraitKey } from '../../../../core/sort/manager.js';
import { createSortUtils } from '../../../../core/sort/utils.js';
import {
  draggable,
  dragHandler,
  droppable,
} from '../../../../core/utils/wc-dnd/dnd-context.js';
import type { Property } from '../../../../core/view-manager/property.js';
import { numberFormats } from '../../../../property-presets/number/utils/formats.js';
import {
  createDefaultShowQuickSettingBar,
  ShowQuickSettingBarKey,
} from '../../../../widget-presets/quick-setting-bar/context.js';
import { DEFAULT_COLUMN_TITLE_HEIGHT } from '../../consts.js';
import type { TableProperty } from '../../table-view-manager.js';
import type { TableViewUILogic } from '../table-view-ui-logic.js';
import {
  getTableGroupRect,
  getVerticalIndicator,
  startDragWidthAdjustmentBar,
} from './vertical-indicator.js';

export class DatabaseHeaderColumn extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    affine-database-header-column {
      display: flex;
    }

    .affine-database-header-column-grabbing * {
      cursor: grabbing;
    }
  `;

  private readonly _clickColumn = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    this.popMenu();
  };

  private readonly _clickTypeIcon = (event: MouseEvent) => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    if (this.column.type$.value === 'title') {
      return;
    }
    event.stopPropagation();
    popMenu(popupTargetFromElement(this), {
      options: {
        items: this.tableViewManager.propertyMetas$.value.map(config => {
          return menu.action({
            name: config.config.name,
            isSelected: config.type === this.column.type$.value,
            prefix: renderUniLit(config.renderer.icon),
            select: () => {
              this.column.typeSet?.(config.type);
            },
          });
        }),
      },
    });
  };

  private readonly _contextMenu = (e: MouseEvent) => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    e.preventDefault();
    this.popMenu(e.currentTarget as HTMLElement);
  };

  private readonly _enterWidthDragBar = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    if (this.drawWidthDragBarTask) {
      cancelAnimationFrame(this.drawWidthDragBarTask);
      this.drawWidthDragBarTask = 0;
    }
    this.drawWidthDragBar();
  };

  private readonly _leaveWidthDragBar = () => {
    cancelAnimationFrame(this.drawWidthDragBarTask);
    this.drawWidthDragBarTask = 0;
    getVerticalIndicator().remove();
  };

  private readonly drawWidthDragBar = () => {
    const rect = getTableGroupRect(this);
    if (!rect) {
      return;
    }
    getVerticalIndicator().display(
      this.getBoundingClientRect().right,
      rect.top,
      rect.bottom - rect.top
    );
    this.drawWidthDragBarTask = requestAnimationFrame(this.drawWidthDragBar);
  };

  private drawWidthDragBarTask = 0;

  private readonly widthDragBar = createRef();

  editTitle = () => {
    this._clickColumn();
  };

  private get readonly() {
    return this.tableViewManager.readonly$.value;
  }

  private _addFilter() {
    const filterTrait = this.tableViewManager.traitGet(filterTraitKey);
    if (!filterTrait) return;

    const filter = firstFilterByRef(this.tableViewManager.vars$.value, {
      type: 'ref',
      name: this.column.id,
    });

    filterTrait.filterSet({
      type: 'group',
      op: 'and',
      conditions: [filter, ...filterTrait.filter$.value.conditions],
    });

    this._toggleQuickSettingBar();
  }

  private _addSort(desc: boolean) {
    const sortTrait = this.tableViewManager.traitGet(sortTraitKey);
    if (!sortTrait) return;

    const sortUtils = createSortUtils(
      sortTrait,
      this.tableViewLogic.eventTrace
    );
    const sortList = sortUtils.sortList$.value;
    const existingIndex = sortList.findIndex(
      sort => sort.ref.name === this.column.id
    );

    if (existingIndex !== -1) {
      sortUtils.change(existingIndex, {
        ref: { type: 'ref', name: this.column.id },
        desc,
      });
    } else {
      sortUtils.add({
        ref: { type: 'ref', name: this.column.id },
        desc,
      });
    }

    this._toggleQuickSettingBar();
  }

  private _toggleQuickSettingBar(show = true) {
    const map = this.tableViewManager.serviceGetOrCreate(
      ShowQuickSettingBarKey,
      createDefaultShowQuickSettingBar
    );
    map.value = {
      ...map.value,
      [this.tableViewManager.id]: show,
    };
  }

  // Inline sparkle SVG for the AI fill column menu item.
  private readonly _aiSparkleIcon = () => html`<svg
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

  private popMenu(ele?: HTMLElement) {
    const aiAutofill = this.tableViewLogic.root.config.aiAutofill;
    const notification = this.tableViewLogic.root.config.notification;

    popMenu(popupTargetFromElement(ele ?? this), {
      options: {
        items: [
          inputConfig(this.column),
          typeConfig(this.column),
          // Number format begin
          menu.subMenu({
            name: 'Number Format',
            hide: () =>
              !this.column.dataUpdate || this.column.type$.value !== 'number',
            options: {
              items: [
                numberFormatConfig(this.column),
                ...numberFormats.map(format => {
                  const data = this.column.data$.value;
                  return menu.action({
                    isSelected: data.format === format.type,
                    prefix: html`<span
                      style="font-size: var(--affine-font-base); scale: 1.2;"
                      >${format.symbol}</span
                    >`,
                    name: format.label,
                    select: () => {
                      if (data.format === format.type) return;
                      this.column.dataUpdate(() => ({
                        format: format.type,
                      }));
                    },
                  });
                }),
              ],
            },
          }),
          // Number format end
          menu.group({
            items: [
              menu.action({
                name: 'Hide In View',
                prefix: ViewIcon(),
                hide: () => !this.column.hideCanSet,
                select: () => {
                  this.column.hideSet(true);
                },
              }),
            ],
          }),
          // β-AI-7: Bulk fill all empty cells in this column with AI
          menu.group({
            items: [
              menu.action({
                name: '✨ Fill all empty cells with AI',
                prefix: this._aiSparkleIcon(),
                hide: () => aiAutofill == null || this.column.readonly$.value,
                select: () => {
                  if (!aiAutofill) return;
                  const view = this.tableViewManager;
                  const column = this.column;
                  const totalEmptyCount = view.rows$.value.filter(row => {
                    const val = column.stringValueGet(row.rowId);
                    return val == null || val.trim() === '';
                  }).length;

                  if (totalEmptyCount === 0) {
                    notification.toast(
                      'No empty cells found in this column.'
                    );
                    return;
                  }

                  notification.toast(
                    `Filling ${totalEmptyCount} empty cell${totalEmptyCount !== 1 ? 's' : ''} with AI…`
                  );

                  let lastProgress = 0;
                  autofillColumn(
                    view,
                    column,
                    aiAutofill,
                    (filled, total) => {
                      // Surface intermediate progress every 5 cells to avoid toast spam.
                      if (filled - lastProgress >= 5 || filled === total) {
                        lastProgress = filled;
                        notification.toast(
                          `Filling cells… ${filled}/${total} done`
                        );
                      }
                    }
                  )
                    .then(filled => {
                      notification.toast(
                        `AI filled ${filled} cell${filled !== 1 ? 's' : ''} in "${column.name$.value}"`
                      );
                    })
                    .catch((err: unknown) => {
                      console.error('[AI autofill column] failed', err);
                      notification.toast(
                        'AI autofill failed. Please try again.'
                      );
                    });
                },
              }),
            ],
          }),
          menu.group({
            items: [
              menu.action({
                name: 'Filter',
                prefix: FilterIcon(),
                select: () => this._addFilter(),
              }),
              menu.action({
                name: 'Sort Ascending',
                prefix: SortIcon(),
                select: () => this._addSort(false),
              }),
              menu.action({
                name: 'Sort Descending',
                prefix: SortIcon(),
                select: () => this._addSort(true),
              }),
            ],
          }),
          menu.group({
            items: [
              menu.action({
                name: 'Insert Left Column',
                prefix: InsertLeftIcon(),
                select: () => {
                  this.tableViewManager.propertyAdd({
                    id: this.column.id,
                    before: true,
                  });
                  Promise.resolve()
                    .then(() => {
                      const pre =
                        this.previousElementSibling?.previousElementSibling;
                      if (pre instanceof DatabaseHeaderColumn) {
                        pre.editTitle();
                        pre.scrollIntoView({
                          inline: 'nearest',
                          block: 'nearest',
                        });
                      }
                    })
                    .catch(console.error);
                },
              }),
              menu.action({
                name: 'Insert Right Column',
                prefix: InsertRightIcon(),
                select: () => {
                  this.tableViewManager.propertyAdd({
                    id: this.column.id,
                    before: false,
                  });
                  Promise.resolve()
                    .then(() => {
                      const next = this.nextElementSibling?.nextElementSibling;
                      if (next instanceof DatabaseHeaderColumn) {
                        next.editTitle();
                        next.scrollIntoView({
                          inline: 'nearest',
                          block: 'nearest',
                        });
                      }
                    })
                    .catch(console.error);
                },
              }),
              menu.action({
                name: 'Move Left',
                prefix: MoveLeftIcon(),
                hide: () => this.column.isFirst$.value,
                select: () => {
                  const prev = this.column.prev$.value;
                  if (!prev) {
                    return;
                  }
                  this.column.move({
                    id: prev.id,
                    before: true,
                  });
                },
              }),
              menu.action({
                name: 'Move Right',
                prefix: MoveRightIcon(),
                hide: () => this.column.isLast$.value,
                select: () => {
                  const next = this.column.next$.value;
                  if (!next) {
                    return;
                  }
                  this.column.move({
                    id: next.id,
                    before: false,
                  });
                },
              }),
            ],
          }),
          menu.group({
            items: [
              menu.action({
                name: 'Duplicate',
                prefix: DuplicateIcon(),
                hide: () => !this.column.canDuplicate,
                select: () => {
                  this.column.duplicate?.();
                },
              }),
              menu.action({
                name: 'Delete',
                prefix: DeleteIcon(),
                hide: () => !this.column.canDelete,
                select: () => {
                  this.column.delete?.();
                },
                class: {
                  'delete-item': true,
                },
              }),
            ],
          }),
        ],
      },
    });
  }

  private widthDragStart(event: PointerEvent) {
    startDragWidthAdjustmentBar(
      event,
      this,
      this.getBoundingClientRect().width,
      this.column
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    const table = this.closest('dv-table-view-ui');
    if (table) {
      this.disposables.add(
        table.logic.handleEvent('dragStart', context => {
          if (this.tableViewManager.readonly$.value) {
            return;
          }
          const event = context.get('pointerState').raw;
          const target = event.target;
          if (
            target instanceof Element &&
            this.widthDragBar.value?.contains(target)
          ) {
            event.preventDefault();
            event.stopPropagation();
            this.widthDragStart(event);
            return true;
          }
          return false;
        })
      );
    }
  }

  override render() {
    const column = this.column;
    const style = styleMap({
      height: DEFAULT_COLUMN_TITLE_HEIGHT + 'px',
    });
    const classes = classMap({
      'affine-database-column-move': true,
      [this.grabStatus]: true,
    });
    return html`
      <div
        style=${style}
        class="affine-database-column-content"
        @click="${this._clickColumn}"
        @contextmenu="${this._contextMenu}"
        ${dragHandler(column.id)}
        ${draggable(column.id)}
        ${droppable(column.id)}
      >
        ${this.readonly
          ? null
          : html` <button class="${classes}">
              <div class="hover-trigger"></div>
              <div class="control-h"></div>
              <div class="control-l"></div>
              <div class="control-r"></div>
            </button>`}
        <div class="affine-database-column-text ${column.type$.value}">
          <div
            class="affine-database-column-type-icon dv-hover"
            @click="${this._clickTypeIcon}"
          >
            <uni-lit .uni="${column.icon}"></uni-lit>
          </div>
          <div class="affine-database-column-text-content">
            <div class="affine-database-column-text-input">
              ${column.name$.value}
            </div>
          </div>
        </div>
      </div>
      <div
        ${ref(this.widthDragBar)}
        @mouseenter="${this._enterWidthDragBar}"
        @mouseleave="${this._leaveWidthDragBar}"
        style="width: 0;position: relative;height: 100%;z-index: 1;cursor: col-resize"
      >
        <div style="width: 8px;height: 100%;margin-left: -4px;"></div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor column!: TableProperty;

  @property({ attribute: false })
  accessor grabStatus: 'grabStart' | 'grabEnd' | 'grabbing' = 'grabEnd';

  @property({ attribute: false })
  accessor tableViewLogic!: TableViewUILogic;

  get tableViewManager() {
    return this.tableViewLogic.view;
  }
}

function numberFormatConfig(column: Property): MenuConfig {
  return () =>
    html` <affine-database-number-format-bar
      .column="${column}"
    ></affine-database-number-format-bar>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-header-column': DatabaseHeaderColumn;
  }
}
