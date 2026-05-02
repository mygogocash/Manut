import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { css } from '@emotion/css';
import { computed, signal } from '@preact/signals-core';
import { type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { CalendarSingleView } from '../calendar-view-manager.js';
import type { CalendarViewSelectionWithType } from '../selection.js';

// ─── styles ───────────────────────────────────────────────────────────────

const calendarViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  font-size: 14px;
`;

const calendarHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
`;

const calendarHeaderTitleStyle = css`
  font-weight: 600;
  font-size: 18px;
`;

const calendarHeaderNavStyle = css`
  display: flex;
  gap: 8px;

  button {
    appearance: none;
    border: 1px solid var(--affine-border-color, #e3e3e3);
    background: transparent;
    color: inherit;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
  }
  button:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const calendarGridStyle = css`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-top: 1px solid var(--affine-border-color, #e3e3e3);
  border-left: 1px solid var(--affine-border-color, #e3e3e3);
`;

const dayHeaderStyle = css`
  padding: 6px 8px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--affine-text-secondary-color, #888);
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.02));
`;

const dayCellStyle = css`
  min-height: 110px;
  padding: 6px;
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: background 0.1s ease;
`;

const dayCellHoverStyle = css`
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const dayNumberStyle = css`
  font-size: 12px;
  color: var(--affine-text-secondary-color, #888);
`;

const dayNumberTodayStyle = css`
  font-size: 12px;
  font-weight: 700;
  color: var(--affine-primary-color, #1e90ff);
`;

const otherMonthCellStyle = css`
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.015));
  color: var(--affine-text-disable-color, #bbb);
`;

const eventChipStyle = css`
  background: var(--affine-tag-blue, #cfe6ff);
  color: var(--affine-text-primary-color, #111);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
`;

const moreCountStyle = css`
  font-size: 11px;
  color: var(--affine-text-secondary-color, #888);
  padding-left: 4px;
`;

const noDateColumnHintStyle = css`
  padding: 24px;
  border: 1px dashed var(--affine-border-color, #e3e3e3);
  color: var(--affine-text-secondary-color, #888);
  border-radius: 8px;
  text-align: center;
`;

// ─── UI logic ─────────────────────────────────────────────────────────────

export class CalendarViewUILogic extends DataViewUILogicBase<
  CalendarSingleView,
  CalendarViewSelectionWithType
> {
  ui$ = signal<CalendarViewUI | undefined>();

  /** First-day-of-month currently displayed. */
  visibleMonth$ = signal<Date>(startOfMonth(new Date()));

  /** Computed visible window: includes leading/trailing days from neighbouring months to fill 6×7 grid. */
  visibleRange$ = computed(() => calendarGridRange(this.visibleMonth$.value));

  rowsByDay$ = computed(() => this.view.rowsByDay$.value);

  private get readonly() {
    return this.view.readonly$.value;
  }

  goPrevMonth = () => {
    const cur = this.visibleMonth$.value;
    this.visibleMonth$.value = startOfMonth(
      new Date(cur.getFullYear(), cur.getMonth() - 1, 1)
    );
  };

  goNextMonth = () => {
    const cur = this.visibleMonth$.value;
    this.visibleMonth$.value = startOfMonth(
      new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    );
  };

  goToday = () => {
    this.visibleMonth$.value = startOfMonth(new Date());
  };

  openRow = (rowId: string) => {
    this.root.openDetailPanel({
      view: this.view,
      rowId,
    });
  };

  /**
   * Add a new row dated on the given day. The date column is set to that day's noon
   * (avoids edge-of-day TZ jumps). Then the detail panel opens for further edits.
   */
  addRowOnDay = (day: Date) => {
    if (this.readonly) return;
    const rowId = this.view.addRowWithDefaults('end');
    if (!rowId) return;

    const noon = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      12,
      0,
      0
    );
    this.view.setRowDate(rowId, noon.getTime());
    this.openRow(rowId);
  };

  // ─── Abstract members required by DataViewUILogicBase ─────────────────
  // Calendar view's MVP doesn't implement selection or drag indicators yet.
  // Stubs satisfy the type contract; future work would wire real behaviour.

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = (_position: InsertToPosition) => {
    if (this.readonly) return undefined;
    const rowId = this.view.addRowWithDefaults('end');
    if (rowId) {
      this.openRow(rowId);
    }
    return rowId;
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in calendar MVP.
  };

  showIndicator = (_evt: MouseEvent) => {
    // Drag-drop reschedule deferred to follow-up. No drop indicator.
    return false;
  };

  hideIndicator = () => {
    // No-op (no indicator to hide).
  };

  moveTo = (_id: string, _evt: MouseEvent) => {
    // Drag-drop reschedule deferred to follow-up.
  };

  renderer = createUniComponentFromWebComponent(CalendarViewUI);
}

// ─── Lit element ──────────────────────────────────────────────────────────

export class CalendarViewUI extends DataViewUIBase<CalendarViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(calendarViewStyle);
  }

  private renderHeader(): TemplateResult {
    const month = this.logic.visibleMonth$.value;
    const title = `${month.toLocaleString('default', { month: 'long' })} ${month.getFullYear()}`;
    return html`
      <div class=${calendarHeaderStyle}>
        <div class=${calendarHeaderTitleStyle}>${title}</div>
        <div class=${calendarHeaderNavStyle}>
          <button @click=${this.logic.goPrevMonth}>‹</button>
          <button @click=${this.logic.goToday}>Today</button>
          <button @click=${this.logic.goNextMonth}>›</button>
        </div>
      </div>
    `;
  }

  private renderDayHeaders(): TemplateResult {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return html`${days.map(d => html`<div class=${dayHeaderStyle}>${d}</div>`)}`;
  }

  private renderCell(date: Date): TemplateResult {
    const month = this.logic.visibleMonth$.value;
    const isOtherMonth = date.getMonth() !== month.getMonth();
    const isToday = isSameDay(date, new Date());

    const key = dateKey(date);
    const rowIds = this.logic.rowsByDay$.value.get(key) ?? [];
    const visible = rowIds.slice(0, 3);
    const overflow = rowIds.length - visible.length;

    const classes = [dayCellStyle, dayCellHoverStyle];
    if (isOtherMonth) classes.push(otherMonthCellStyle);

    return html`
      <div
        class=${classes.join(' ')}
        @click=${(e: MouseEvent) => {
          // only fire if the click landed on the cell itself, not an event chip
          if (e.target === e.currentTarget) {
            this.logic.addRowOnDay(date);
          }
        }}
      >
        <div
          class=${isToday ? dayNumberTodayStyle : dayNumberStyle}
          style=${styleMap({ alignSelf: 'flex-end' })}
        >
          ${date.getDate()}
        </div>
        ${visible.map(rowId => {
          const label = this.logic.view.rowTitle(rowId);
          return html`
            <div
              class=${eventChipStyle}
              title=${label}
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.logic.openRow(rowId);
              }}
            >
              ${label || 'Untitled'}
            </div>
          `;
        })}
        ${overflow > 0
          ? html`<div class=${moreCountStyle}>+${overflow} more</div>`
          : ''}
      </div>
    `;
  }

  override render(): TemplateResult {
    const dateColId = this.logic.view.dateColumnId$.value;
    if (!dateColId) {
      return html`
        ${renderUniLit(this.logic.root.config.headerWidget, {
          dataViewLogic: this.logic,
        })}
        <div class=${noDateColumnHintStyle}>
          This calendar view has no date column configured.<br />
          Add a property of type <strong>Date</strong> to this database, then
          open view settings to pick it as the calendar axis.
        </div>
      `;
    }

    const range = this.logic.visibleRange$.value;

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this.renderHeader()}
      <div class=${calendarGridStyle}>
        ${this.renderDayHeaders()}
        ${range.map(d => this.renderCell(d))}
      </div>
    `;
  }
}

// ─── date helpers ─────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Returns 42 contiguous Date objects (6 weeks × 7 days) covering the visible month.
 * Week starts on Monday.
 */
function calendarGridRange(monthStart: Date): Date[] {
  const firstDay = new Date(monthStart);
  // shift to Monday-of-week containing the 1st
  const dayOfWeek = (firstDay.getDay() + 6) % 7; // Mon=0..Sun=6
  firstDay.setDate(firstDay.getDate() - dayOfWeek);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(
      new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i)
    );
  }
  return days;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-calendar': CalendarViewUI;
  }
}
