import './menu.js';

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
import { CalendarDragController } from './controller/drag.js';

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
  position: relative;
`;

const settingsButtonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const settingsWrapperStyle = css`
  position: relative;
`;

const calendarHeaderTitleStyle = css`
  font-weight: 600;
  font-size: 18px;
`;

const calendarHeaderNavStyle = css`
  display: flex;
  gap: 8px;
  align-items: center;

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

const modeToggleStyle = css`
  display: flex;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 6px;
  overflow: hidden;

  button {
    appearance: none;
    border: none;
    border-right: 1px solid var(--affine-border-color, #e3e3e3);
    background: transparent;
    color: inherit;
    padding: 4px 10px;
    cursor: pointer;
    border-radius: 0;
    font-size: 12px;
  }
  button:last-child {
    border-right: none;
  }
  button:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
  button.active {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.08));
    font-weight: 600;
  }
`;

const calendarGridStyle = css`
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--affine-border-color, #e3e3e3);
  border-left: 1px solid var(--affine-border-color, #e3e3e3);
`;

const calendarDayHeaderRowStyle = css`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
`;

const calendarWeekRowStyle = css`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  position: relative;
`;

const spanBarStyle = css`
  position: absolute;
  background: var(--affine-primary-color, #1e90ff);
  border-radius: 4px;
  height: 20px;
  opacity: 0.85;
  overflow: hidden;
  white-space: nowrap;
  padding: 0 4px;
  font-size: 11px;
  color: #fff;
  line-height: 20px;
  z-index: 2;
  pointer-events: none;
  box-sizing: border-box;
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

// ─── Time grid styles ──────────────────────────────────────────────────────

const timeGridStyle = css`
  display: flex;
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid var(--affine-border-color, #e3e3e3);
`;

const timeAxisStyle = css`
  width: 48px;
  flex-shrink: 0;
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
`;

const timeSlotStyle = css`
  height: 60px;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  padding: 2px 4px;
  font-size: 11px;
  color: var(--affine-text-secondary-color, #888);
`;

const dayColumnStyle = css`
  flex: 1;
  position: relative;
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
`;

const dayColumnSlotStyle = css`
  height: 60px;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  box-sizing: border-box;
`;

const eventInTimeGridStyle = css`
  position: absolute;
  left: 2px;
  right: 2px;
  background: var(--affine-tag-blue, #cfe6ff);
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
  overflow: hidden;
  cursor: pointer;
  min-height: 30px;
  box-sizing: border-box;
  z-index: 1;
`;

const weekHeaderRowStyle = css`
  display: flex;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
`;

const weekHeaderCellStyle = css`
  flex: 1;
  padding: 6px 8px;
  font-size: 12px;
  text-align: center;
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
  color: var(--affine-text-secondary-color, #888);
`;

const weekHeaderAxisStyle = css`
  width: 48px;
  flex-shrink: 0;
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
`;

// ─── UI logic ─────────────────────────────────────────────────────────────

export class CalendarViewUILogic extends DataViewUILogicBase<
  CalendarSingleView,
  CalendarViewSelectionWithType
> {
  ui$ = signal<CalendarViewUI | undefined>();

  dragController = new CalendarDragController(this);

  /** First-day-of-month currently displayed. */
  visibleMonth$ = signal<Date>(startOfMonth(new Date()));

  /** Anchor date for week/day views. */
  visibleDate$ = signal<Date>(new Date());

  /** Computed visible window: includes leading/trailing days from neighbouring months to fill 6×7 grid. */
  visibleRange$ = computed(() => calendarGridRange(this.visibleMonth$.value));

  rowsByDay$ = computed(() => this.view.rowsByDay$.value);

  /** Whether the settings dropdown is open. */
  settingsOpen$ = signal(false);

  toggleSettings = () => {
    this.settingsOpen$.value = !this.settingsOpen$.value;
  };

  closeSettings = () => {
    this.settingsOpen$.value = false;
  };

  private get readonly() {
    return this.view.readonly$.value;
  }

  goPrev = () => {
    const mode = this.view.displayMode$.value;
    if (mode === 'week') {
      const cur = this.visibleDate$.value;
      const prev = new Date(cur);
      prev.setDate(prev.getDate() - 7);
      this.visibleDate$.value = prev;
    } else if (mode === 'day') {
      const cur = this.visibleDate$.value;
      const prev = new Date(cur);
      prev.setDate(prev.getDate() - 1);
      this.visibleDate$.value = prev;
    } else {
      this.goPrevMonth();
    }
  };

  goNext = () => {
    const mode = this.view.displayMode$.value;
    if (mode === 'week') {
      const cur = this.visibleDate$.value;
      const next = new Date(cur);
      next.setDate(next.getDate() + 7);
      this.visibleDate$.value = next;
    } else if (mode === 'day') {
      const cur = this.visibleDate$.value;
      const next = new Date(cur);
      next.setDate(next.getDate() + 1);
      this.visibleDate$.value = next;
    } else {
      this.goNextMonth();
    }
  };

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
    this.visibleDate$.value = new Date();
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
    // Indicator is managed directly by CalendarDragController during pointer drag.
    return false;
  };

  hideIndicator = () => {
    this.dragController.hideDropIndicator();
  };

  moveTo = (id: string, evt: MouseEvent) => {
    if (this.view.readonly$.value) return;
    this.dragController.dragStart(id, evt as unknown as PointerEvent);
  };

  renderer = createUniComponentFromWebComponent(CalendarViewUI);
}

// ─── Lit element ──────────────────────────────────────────────────────────

export class CalendarViewUI extends DataViewUIBase<CalendarViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.logic.dragController.hostConnected();
    this.classList.add(calendarViewStyle);
  }

  private renderHeader(): TemplateResult {
    const mode = this.logic.view.displayMode$.value;
    const settingsOpen = this.logic.settingsOpen$.value;
    let title: string;

    if (mode === 'week') {
      const monday = getMondayOfWeek(this.logic.visibleDate$.value);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const startStr = monday.toLocaleString('default', {
        month: 'short',
        day: 'numeric',
      });
      const endStr = sunday.toLocaleString('default', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      title = `${startStr} – ${endStr}`;
    } else if (mode === 'day') {
      const d = this.logic.visibleDate$.value;
      title = d.toLocaleString('default', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } else {
      const month = this.logic.visibleMonth$.value;
      title = `${month.toLocaleString('default', { month: 'long' })} ${month.getFullYear()}`;
    }

    return html`
      <div class=${calendarHeaderStyle}>
        <div class=${calendarHeaderTitleStyle}>${title}</div>
        <div class=${calendarHeaderNavStyle}>
          <button @click=${this.logic.goPrev}>‹</button>
          <button @click=${this.logic.goToday}>Today</button>
          <button @click=${this.logic.goNext}>›</button>
          <div class=${modeToggleStyle}>
            <button
              class=${mode === 'month' ? 'active' : ''}
              @click=${() => this.logic.view.setDisplayMode('month')}
            >
              Mon
            </button>
            <button
              class=${mode === 'week' ? 'active' : ''}
              @click=${() => this.logic.view.setDisplayMode('week')}
            >
              Wk
            </button>
            <button
              class=${mode === 'day' ? 'active' : ''}
              @click=${() => this.logic.view.setDisplayMode('day')}
            >
              Day
            </button>
          </div>
          <div class=${settingsWrapperStyle}>
            <button
              class=${settingsButtonStyle}
              title="Calendar settings"
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.logic.toggleSettings();
              }}
            >
              ⚙
            </button>
            ${settingsOpen
              ? html`<affine-data-view-calendar-settings-menu
                  .view=${this.logic.view}
                  @close=${() => this.logic.closeSettings()}
                ></affine-data-view-calendar-settings-menu>`
              : ''}
          </div>
        </div>
      </div>
    `;
  }

  private renderDayHeaders(): TemplateResult {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return html`
      <div class=${calendarDayHeaderRowStyle}>
        ${days.map(d => html`<div class=${dayHeaderStyle}>${d}</div>`)}
      </div>
    `;
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
        data-date=${key}
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
              @pointerdown=${(e: PointerEvent) => {
                e.stopPropagation();
                this.logic.dragController.dragStart(rowId, e);
              }}
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

  private renderTimeGridColumn(date: Date): TemplateResult {
    const key = dateKey(date);
    const rowIds = this.logic.rowsByDay$.value.get(key) ?? [];
    const slots = Array.from({ length: 24 }, (_, i) => i);

    return html`
      <div class=${dayColumnStyle}>
        ${slots.map(() => html`<div class=${dayColumnSlotStyle}></div>`)}
        ${rowIds.map(rowId => {
          const label = this.logic.view.rowTitle(rowId);
          const hour = getRowHour(this.logic, rowId);
          return html`
            <div
              class=${eventInTimeGridStyle}
              style=${styleMap({ top: `${hour * 60}px` })}
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
      </div>
    `;
  }

  private renderWeekRow(weekDays: Date[]): TemplateResult {
    // Collect spans that overlap this week row and render them as absolute bars.
    const spans = this.logic.view.spans$.value;
    const weekStart = dateKey(weekDays[0]);
    const weekEnd = dateKey(weekDays[6]);

    // For each span visible in this week, compute column positions (0-indexed).
    const spanBars = spans
      .map(span => {
        // Clamp the span to this week
        const clampedStart = span.startDay < weekStart ? weekStart : span.startDay;
        const clampedEnd = span.endDay > weekEnd ? weekEnd : span.endDay;
        if (clampedStart > weekEnd || clampedEnd < weekStart) return null;
        // Find column indices
        const startCol = weekDays.findIndex(d => dateKey(d) === clampedStart);
        const endCol = weekDays.findIndex(d => dateKey(d) === clampedEnd);
        if (startCol < 0 || endCol < 0) return null;
        const colSpan = endCol - startCol + 1;
        const label = this.logic.view.rowTitle(span.rowId);
        return { startCol, colSpan, label };
      })
      .filter(Boolean) as { startCol: number; colSpan: number; label: string }[];

    return html`
      <div class=${calendarWeekRowStyle}>
        ${weekDays.map(d => this.renderCell(d))}
        ${spanBars.map(bar => {
          const leftPct = (bar.startCol / 7) * 100;
          const widthPct = (bar.colSpan / 7) * 100;
          return html`
            <div
              class=${spanBarStyle}
              style=${styleMap({
                left: `${leftPct}%`,
                width: `calc(${widthPct}% - 4px)`,
                top: '28px',
              })}
              title=${bar.label}
            >
              ${bar.label || 'Untitled'}
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderMonthView(): TemplateResult {
    const range = this.logic.visibleRange$.value;
    // Split 42 days into 6 weeks of 7
    const weeks: Date[][] = [];
    for (let i = 0; i < 6; i++) {
      weeks.push(range.slice(i * 7, i * 7 + 7));
    }
    return html`
      ${this.renderHeader()}
      <div class=${calendarGridStyle}>
        ${this.renderDayHeaders()}
        ${weeks.map(week => this.renderWeekRow(week))}
      </div>
    `;
  }

  private renderWeekView(): TemplateResult {
    const anchor = this.logic.visibleDate$.value;
    const monday = getMondayOfWeek(anchor);
    const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return html`
      ${this.renderHeader()}
      <div class=${weekHeaderRowStyle}>
        <div class=${weekHeaderAxisStyle}></div>
        ${weekDays.map(
          (d, i) => html`
            <div class=${weekHeaderCellStyle}>
              ${dayNames[i]} ${d.getDate()}
            </div>
          `
        )}
      </div>
      <div class=${timeGridStyle}>
        <div class=${timeAxisStyle}>
          ${hours.map(
            h =>
              html`<div class=${timeSlotStyle}>
                ${h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>`
          )}
        </div>
        ${weekDays.map(d => this.renderTimeGridColumn(d))}
      </div>
    `;
  }

  private renderDayView(): TemplateResult {
    const d = this.logic.visibleDate$.value;
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return html`
      ${this.renderHeader()}
      <div class=${weekHeaderRowStyle}>
        <div class=${weekHeaderAxisStyle}></div>
        <div class=${weekHeaderCellStyle}>
          ${d.toLocaleString('default', { weekday: 'short' })} ${d.getDate()}
        </div>
      </div>
      <div class=${timeGridStyle}>
        <div class=${timeAxisStyle}>
          ${hours.map(
            h =>
              html`<div class=${timeSlotStyle}>
                ${h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>`
          )}
        </div>
        ${this.renderTimeGridColumn(d)}
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
        ${this.renderHeader()}
        <div class=${noDateColumnHintStyle}>
          This calendar view has no date column configured.<br />
          Use the ⚙ settings button above to pick a date property, or add a
          property of type <strong>Date</strong> to this database first.
        </div>
      `;
    }

    const mode = this.logic.view.displayMode$.value;

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${mode === 'week'
        ? this.renderWeekView()
        : mode === 'day'
          ? this.renderDayView()
          : this.renderMonthView()}
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
 * Returns the Monday of the week containing `d` (ISO 8601, week starts Monday).
 */
function getMondayOfWeek(d: Date): Date {
  const result = new Date(d);
  const dayOfWeek = (result.getDay() + 6) % 7; // Mon=0..Sun=6
  result.setDate(result.getDate() - dayOfWeek);
  result.setHours(0, 0, 0, 0);
  return result;
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
      new Date(
        firstDay.getFullYear(),
        firstDay.getMonth(),
        firstDay.getDate() + i
      )
    );
  }
  return days;
}

/**
 * Read the hour (0-23) for a given row from the date column value.
 * Falls back to 0 if the hour cannot be determined.
 */
function getRowHour(logic: CalendarViewUILogic, rowId: string): number {
  const colId = logic.view.dateColumnId$.value;
  if (!colId) return 0;
  try {
    const property = logic.view.propertyGetOrCreate(colId);
    const raw = property.cellGetOrCreate(rowId).jsonValue$.value;
    if (raw == null) return 0;
    const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
    if (Number.isNaN(ms)) return 0;
    return new Date(ms).getHours();
  } catch {
    return 0;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-calendar': CalendarViewUI;
  }
}
