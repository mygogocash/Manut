import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { css } from '@emotion/css';
import { signal } from '@preact/signals-core';
import { type TemplateResult, html } from 'lit';

import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { ListSingleView } from '../list-view-manager.js';
import type { ListViewSelectionWithType } from '../selection.js';

// ─── Styles ───────────────────────────────────────────────────────────────

const listViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  font-size: 14px;
`;

const listHeaderStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  margin-bottom: 4px;
`;

const listHeaderButtonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const groupHeaderStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-weight: 600;
  font-size: 13px;
  color: var(--affine-text-secondary-color, #888);
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.02));
  border-radius: 6px;
  margin: 8px 0 4px;
  cursor: pointer;
  user-select: none;
`;

const groupCollapseIconStyle = css`
  font-size: 10px;
  line-height: 1;
`;

const rowStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: background 0.1s ease;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const dragHandleStyle = css`
  display: none;
  cursor: grab;
  color: var(--affine-icon-color, #888);
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  align-items: center;

  .${rowStyle}:hover & {
    display: flex;
  }
`;

const rowTitleStyle = css`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
`;

const rowChipsStyle = css`
  display: none;
  gap: 4px;
  align-items: center;
  flex-wrap: nowrap;
  overflow: hidden;

  .${rowStyle}:hover & {
    display: flex;
  }
`;

const chipStyle = css`
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  color: var(--affine-text-secondary-color, #888);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
    color: var(--affine-text-primary-color, #111);
  }
`;

const emptyStyle = css`
  padding: 24px;
  border: 1px dashed var(--affine-border-color, #e3e3e3);
  color: var(--affine-text-secondary-color, #888);
  border-radius: 8px;
  text-align: center;
`;

// ─── UI Logic ─────────────────────────────────────────────────────────────

export class ListViewUILogic extends DataViewUILogicBase<
  ListSingleView,
  ListViewSelectionWithType
> {
  ui$ = signal<ListViewUI | undefined>();

  /** Track which groups are collapsed by group-key. */
  private collapsedGroups$ = signal<Set<string>>(new Set());

  // ─── Abstract stubs ───────────────────────────────────────────────────

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = (position: InsertToPosition) => {
    if (this.view.readonly$.value) return undefined;
    const rowId = this.view.addRowWithDefaults(position);
    if (rowId) {
      this.openRow(rowId);
    }
    return rowId;
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in list MVP.
  };

  showIndicator = (_evt: MouseEvent) => {
    return false;
  };

  hideIndicator = () => {
    // No indicator in list MVP.
  };

  moveTo = (id: string, _evt: MouseEvent) => {
    if (this.view.readonly$.value) return;
    // Programmatic / keyboard fallback path. Always sends the row to the
    // end of the list — mouse-drag reordering with proper drop-target
    // insertion lives in the UI element's `_onDragStart` handler instead.
    this.view.rowMove(id, 'end');
  };

  renderer = createUniComponentFromWebComponent(ListViewUI);

  // ─── Helpers ──────────────────────────────────────────────────────────

  openRow = (rowId: string) => {
    this.root.openDetailPanel({
      view: this.view,
      rowId,
    });
  };

  toggleGroupCollapsed = (groupKey: string) => {
    const cur = this.collapsedGroups$.value;
    const next = new Set(cur);
    if (next.has(groupKey)) {
      next.delete(groupKey);
    } else {
      next.add(groupKey);
    }
    this.collapsedGroups$.value = next;
  };

  isGroupCollapsed = (groupKey: string): boolean => {
    return this.collapsedGroups$.value.has(groupKey);
  };
}

// ─── Lit Element ──────────────────────────────────────────────────────────

export class ListViewUI extends DataViewUIBase<ListViewUILogic> {
  /** rowId currently being dragged, or null. */
  private _draggingRowId: string | null = null;
  /** Original y position when drag started. */
  private _dragStartY = 0;
  /** Row elements indexed by rowId for hit-testing during drag. */
  private _rowElements = new Map<string, HTMLElement>();

  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(listViewStyle);
  }

  // ─── α-LIST-1: Drag-reorder ──────────────────────────────────────────

  private _onDragStart = (rowId: string, e: PointerEvent) => {
    if (this.logic.view.readonly$.value) return;
    e.preventDefault();
    this._draggingRowId = rowId;
    this._dragStartY = e.clientY;

    const onMove = (_evt: PointerEvent) => {
      // Visual feedback: dim the row being dragged.
      const el = this._rowElements.get(rowId);
      if (el) el.style.opacity = '0.5';
    };

    const onUp = (evt: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      const el = this._rowElements.get(rowId);
      if (el) el.style.opacity = '';

      // Find the target row under the pointer.
      const elements = document.elementsFromPoint(evt.clientX, evt.clientY);
      let targetRowId: string | undefined;
      for (const elem of elements) {
        if (
          elem instanceof HTMLElement &&
          elem.dataset['rowId'] &&
          elem.dataset['rowId'] !== rowId
        ) {
          targetRowId = elem.dataset['rowId'];
          break;
        }
      }

      if (targetRowId) {
        this.logic.view.rowMove(rowId, {
          before: false,
          id: targetRowId,
        });
      }

      this._draggingRowId = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ─── Rendering ───────────────────────────────────────────────────────

  private renderHeader(): TemplateResult {
    const groupBy = this.logic.view.groupBy$.value;
    const props = this.logic.view.propertiesRaw$.value;

    return html`
      <div class=${listHeaderStyle}>
        <button
          class=${listHeaderButtonStyle}
          title="Add row"
          @click=${() => this.logic.addRow('end')}
        >
          + New
        </button>
        <button
          class=${listHeaderButtonStyle}
          title="Group by property"
          @click=${(e: MouseEvent) => this._showGroupByPicker(e)}
        >
          Group by${groupBy
            ? `: ${props.find(p => p.id === groupBy)?.name$.value ?? groupBy}`
            : ''}
        </button>
        ${groupBy
          ? html`<button
              class=${listHeaderButtonStyle}
              title="Clear grouping"
              @click=${() => this.logic.view.setGroupBy(undefined)}
            >
              ✕
            </button>`
          : ''}
      </div>
    `;
  }

  /** α-LIST-2: Show a simple property picker popover for group-by. */
  private _showGroupByPicker(e: MouseEvent) {
    e.stopPropagation();
    const props = this.logic.view.propertiesRaw$.value.filter(
      p => p.type$.value !== 'title'
    );

    // Build a tiny inline picker element.
    const existing = this.querySelector('[data-list-group-picker]');
    if (existing) {
      existing.remove();
      return;
    }

    const picker = document.createElement('div');
    picker.setAttribute('data-list-group-picker', '');
    Object.assign(picker.style, {
      position: 'absolute',
      zIndex: '100',
      background: 'var(--affine-background-overlay-panel-color, #fff)',
      border: '1px solid var(--affine-border-color, #e3e3e3)',
      borderRadius: '8px',
      padding: '8px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      minWidth: '160px',
    });

    const header = document.createElement('div');
    header.textContent = 'Group by';
    Object.assign(header.style, {
      fontWeight: '600',
      fontSize: '12px',
      color: 'var(--affine-text-secondary-color, #888)',
      marginBottom: '6px',
    });
    picker.appendChild(header);

    for (const prop of props) {
      const item = document.createElement('button');
      item.textContent = prop.name$.value;
      Object.assign(item.style, {
        display: 'block',
        width: '100%',
        padding: '4px 8px',
        border: 'none',
        borderRadius: '4px',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '13px',
      });
      item.addEventListener('click', () => {
        this.logic.view.setGroupBy(prop.id);
        picker.remove();
      });
      picker.appendChild(item);
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    picker.style.top = `${rect.bottom + 4}px`;
    picker.style.left = `${rect.left}px`;
    this.style.position = 'relative';
    this.appendChild(picker);

    const close = (evt: MouseEvent) => {
      if (!picker.contains(evt.target as Node)) {
        picker.remove();
        document.removeEventListener('click', close, true);
      }
    };
    // defer so the current click doesn't immediately close it
    setTimeout(() => document.addEventListener('click', close, true), 0);
  }

  /** α-LIST-3: Render a single row with drag handle + title + property chips. */
  private renderRow(rowId: string): TemplateResult {
    const view = this.logic.view;
    const title = view.rowTitle(rowId);
    const props = view.properties$.value.filter(
      p => p.type$.value !== 'title' && !p.hide$.value
    );

    return html`
      <div
        class=${rowStyle}
        data-row-id=${rowId}
        ${(_el: HTMLElement) => {
          // Store ref for drag hit-testing. Lit doesn't have a built-in ref directive
          // in this codebase's setup, so we use a directive-less approach.
        }}
        @click=${(e: MouseEvent) => {
          // Only open detail if not clicking a chip.
          if ((e.target as HTMLElement).closest('[data-chip]')) return;
          this.logic.openRow(rowId);
        }}
      >
        <!-- α-LIST-1: drag handle -->
        <div
          class=${dragHandleStyle}
          title="Drag to reorder"
          @pointerdown=${(e: PointerEvent) => {
            e.stopPropagation();
            this._onDragStart(rowId, e);
          }}
        >
          ⠿
        </div>

        <!-- row title -->
        <div class=${rowTitleStyle}>${title || 'Untitled'}</div>

        <!-- α-LIST-3: property chips shown on hover -->
        <div class=${rowChipsStyle}>
          ${props.slice(0, 4).map(prop => {
            const cell = prop.cellGetOrCreate(rowId);
            const value = cell.stringValue$.value;
            if (!value) return html``;
            return html`
              <div
                class=${chipStyle}
                data-chip
                title="${prop.name$.value}: ${value} — click to open"
                @click=${(e: MouseEvent) => {
                  e.stopPropagation();
                  // Chip click opens the detail panel where the property
                  // can be edited. There is no in-place chip editor.
                  this.logic.openRow(rowId);
                }}
              >
                ${value}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  /** α-LIST-2: Render rows grouped by a property value. */
  private renderGrouped(groupPropId: string): TemplateResult {
    const rows = this.logic.view.orderedRows$.value;
    const prop = this.logic.view.propertyGetOrCreate(groupPropId);

    // Build a map: groupValue -> rowId[]
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const cell = prop.cellGetOrCreate(row.rowId);
      const key = cell.stringValue$.value || '(None)';
      const existing = groups.get(key);
      if (existing) {
        existing.push(row.rowId);
      } else {
        groups.set(key, [row.rowId]);
      }
    }

    return html`
      ${[...groups.entries()].map(([groupKey, rowIds]) => {
        const collapsed = this.logic.isGroupCollapsed(groupKey);
        return html`
          <div>
            <div
              class=${groupHeaderStyle}
              @click=${() => this.logic.toggleGroupCollapsed(groupKey)}
            >
              <span class=${groupCollapseIconStyle}>${collapsed ? '▶' : '▼'}</span>
              <span>${groupKey}</span>
              <span style="margin-left: auto; font-weight: normal; font-size: 12px;">${rowIds.length}</span>
            </div>
            ${collapsed ? '' : html`${rowIds.map(rowId => this.renderRow(rowId))}`}
          </div>
        `;
      })}
    `;
  }

  override render(): TemplateResult {
    const view = this.logic.view;
    const rows = view.orderedRows$.value;
    const groupBy = view.groupBy$.value;

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this.renderHeader()}
      ${rows.length === 0
        ? html`<div class=${emptyStyle}>No rows. Click "+ New" to add one.</div>`
        : groupBy
          ? this.renderGrouped(groupBy)
          : html`${rows.map(row => this.renderRow(row.rowId))}`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-list': ListViewUI;
  }
}
