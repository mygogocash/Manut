import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { css } from '@emotion/css';
import { signal } from '@preact/signals-core';
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
import type { TimelineViewSelectionWithType } from '../selection.js';
import type { TimelineSingleView } from '../timeline-view-manager.js';

// ─── Styles ─────────────────────────────────────────────────────────────────

const timelineViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font-size: 14px;
  overflow: hidden;
`;

const timelineHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 4px;
`;

const timelineTitleStyle = css`
  font-weight: 600;
  font-size: 18px;
`;

const timelineControlsStyle = css`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const zoomToggleStyle = css`
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

const navButtonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 14px;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const timelineBodyStyle = css`
  display: flex;
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 4px;
`;

const leftPanelStyle = css`
  width: 200px;
  min-width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const leftPanelHeaderStyle = css`
  height: 40px;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  padding: 0 12px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--affine-text-secondary-color, #888);
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.02));
  text-transform: uppercase;
  flex-shrink: 0;
`;

const leftPanelBodyStyle = css`
  overflow-y: auto;
  flex: 1;
`;

const leftPanelRowStyle = css`
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const rightPanelStyle = css`
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const dateAxisStyle = css`
  height: 40px;
  flex-shrink: 0;
  display: flex;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--affine-background-primary-color, #fff);
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
`;

const dateHeaderCellStyle = css`
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 11px;
  color: var(--affine-text-secondary-color, #888);
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
  white-space: nowrap;
  flex-shrink: 0;
`;

const barsContainerStyle = css`
  flex: 1;
  position: relative;
  min-height: 0;
`;

const rowTrackStyle = css`
  height: 36px;
  position: relative;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
`;

const barStyle = css`
  position: absolute;
  height: 24px;
  top: 6px;
  background: var(--affine-primary-color, #1e90ff);
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: grab;
  user-select: none;
  box-sizing: border-box;
  min-width: 4px;
  &:hover {
    filter: brightness(1.1);
  }
  &:active {
    cursor: grabbing;
  }
`;

const noStartDateHintStyle = css`
  padding: 24px;
  border: 1px dashed var(--affine-border-color, #e3e3e3);
  color: var(--affine-text-secondary-color, #888);
  border-radius: 8px;
  text-align: center;
  margin: 16px;
`;

// ─── UI logic ─────────────────────────────────────────────────────────────────

export class TimelineViewUILogic extends DataViewUILogicBase<
  TimelineSingleView,
  TimelineViewSelectionWithType
> {
  ui$ = signal<TimelineViewUI | undefined>();

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = (_position: InsertToPosition) => {
    if (this.view.readonly$.value) return undefined;
    const rowId = this.view.addRowWithDefaults('end');
    if (rowId) {
      this.openRow(rowId);
    }
    return rowId;
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in timeline MVP.
  };

  showIndicator = (_evt: MouseEvent) => false;

  hideIndicator = () => {};

  moveTo = (_id: string, _evt: MouseEvent) => {};

  openRow = (rowId: string) => {
    this.root.openDetailPanel({
      view: this.view,
      rowId,
    });
  };

  /** Scroll the right panel left by ~1 viewport-width of days. */
  goPrev = () => {
    const zoom = this.view.zoomLevel$.value;
    const daysToScroll =
      zoom === 'week'
        ? 7
        : zoom === 'month'
          ? 30
          : zoom === 'quarter'
            ? 90
            : 365;
    const ms = daysToScroll * 86400000;
    this.view.setViewStartDate(this.view.viewStartDate$.value - ms);
  };

  /** Scroll the right panel right by ~1 viewport-width of days. */
  goNext = () => {
    const zoom = this.view.zoomLevel$.value;
    const daysToScroll =
      zoom === 'week'
        ? 7
        : zoom === 'month'
          ? 30
          : zoom === 'quarter'
            ? 90
            : 365;
    const ms = daysToScroll * 86400000;
    this.view.setViewStartDate(this.view.viewStartDate$.value + ms);
  };

  goToday = () => {
    this.view.setViewStartDate(Date.now() - 7 * 86400000);
  };

  renderer = createUniComponentFromWebComponent(TimelineViewUI);
}

// ─── Lit element ──────────────────────────────────────────────────────────────

export class TimelineViewUI extends DataViewUIBase<TimelineViewUILogic> {
  /** Map from rowId → current drag ghost offset in px (null when not dragging). */
  private _dragState: {
    rowId: string;
    startX: number;
    startLeftPx: number;
    currentOffsetPx: number;
  } | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(timelineViewStyle);
  }

  private renderHeader(): TemplateResult {
    const zoom = this.logic.view.zoomLevel$.value;
    const viewStart = new Date(this.logic.view.viewStartDate$.value);
    const title = viewStart.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });

    return html`
      <div class=${timelineHeaderStyle}>
        <div class=${timelineTitleStyle}>Timeline – ${title}</div>
        <div class=${timelineControlsStyle}>
          <button class=${navButtonStyle} @click=${this.logic.goPrev}>‹</button>
          <button class=${navButtonStyle} @click=${this.logic.goToday}>
            Today
          </button>
          <button class=${navButtonStyle} @click=${this.logic.goNext}>›</button>
          <div class=${zoomToggleStyle}>
            ${(['week', 'month', 'quarter', 'year'] as const).map(
              level => html`
                <button
                  class=${zoom === level ? 'active' : ''}
                  @click=${() => this.logic.view.setZoomLevel(level)}
                >
                  ${level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }

  private buildDateHeaders(): Array<{
    label: string;
    widthPx: number;
    startMs: number;
  }> {
    const zoom = this.logic.view.zoomLevel$.value;
    const pixelsPerDay = this.logic.view.pixelsPerDay$.value;
    const viewStart = this.logic.view.viewStartDate$.value;

    // Determine how many days to show: enough to fill ~2000px + buffer
    const totalDays =
      zoom === 'week'
        ? 56
        : zoom === 'month'
          ? 120
          : zoom === 'quarter'
            ? 365
            : 730;

    const headers: Array<{ label: string; widthPx: number; startMs: number }> =
      [];

    if (zoom === 'week' || zoom === 'month') {
      // Weekly headers
      const msPerDay = 86400000;
      let curMs = viewStart;
      const d = new Date(curMs);
      // Snap to start of week (Monday)
      const dow = (d.getDay() + 6) % 7;
      curMs -= dow * msPerDay;

      const endMs = viewStart + totalDays * msPerDay;
      while (curMs < endMs) {
        const weekStart = new Date(curMs);
        const label = weekStart.toLocaleString('default', {
          month: 'short',
          day: 'numeric',
        });
        headers.push({ label, widthPx: 7 * pixelsPerDay, startMs: curMs });
        curMs += 7 * msPerDay;
      }
    } else {
      // Monthly headers for quarter/year
      const startDate = new Date(viewStart);
      const totalMonths = zoom === 'quarter' ? 12 : 24;
      let year = startDate.getFullYear();
      let month = startDate.getMonth();

      for (let i = 0; i < totalMonths; i++) {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 1);
        const daysInMonth =
          (monthEnd.getTime() - monthStart.getTime()) / 86400000;
        const label = monthStart.toLocaleString('default', {
          month: 'short',
          year: 'numeric',
        });
        headers.push({
          label,
          widthPx: daysInMonth * pixelsPerDay,
          startMs: monthStart.getTime(),
        });
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
    }

    return headers;
  }

  private renderDateAxis(): TemplateResult {
    const headers = this.buildDateHeaders();
    const viewStart = this.logic.view.viewStartDate$.value;

    return html`
      <div class=${dateAxisStyle}>
        ${headers.map(h => {
          const offsetPx =
            (h.startMs - viewStart) /
            (86400000 / this.logic.view.pixelsPerDay$.value);
          return html`
            <div
              class=${dateHeaderCellStyle}
              style=${styleMap({
                width: `${h.widthPx}px`,
                position: 'absolute',
                left: `${offsetPx}px`,
              })}
            >
              ${h.label}
            </div>
          `;
        })}
      </div>
    `;
  }

  private startBarDrag(rowId: string, initialLeftPx: number, evt: MouseEvent) {
    evt.preventDefault();
    this._dragState = {
      rowId,
      startX: evt.clientX,
      startLeftPx: initialLeftPx,
      currentOffsetPx: 0,
    };

    const onMove = (e: MouseEvent) => {
      if (!this._dragState) return;
      this._dragState.currentOffsetPx = e.clientX - this._dragState.startX;
      // Re-render to show ghost position
      this.requestUpdate();
    };

    const onUp = (_e: MouseEvent) => {
      if (!this._dragState) return;
      const { rowId: id, startLeftPx, currentOffsetPx } = this._dragState;
      this._dragState = null;

      const pixelsPerDay = this.logic.view.pixelsPerDay$.value;
      const msPerPx = (24 * 3600 * 1000) / pixelsPerDay;
      const viewStart = this.logic.view.viewStartDate$.value;

      const newLeftPx = startLeftPx + currentOffsetPx;
      const newStartMs = viewStart + newLeftPx * msPerPx;

      // Snap to day boundary (noon to avoid TZ edge issues)
      const d = new Date(newStartMs);
      const snappedMs = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        12,
        0,
        0
      ).getTime();

      this.logic.view.setRowDate(id, snappedMs);
      this.requestUpdate();

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private renderBars(): TemplateResult {
    const bars = this.logic.view.rowBars$.value;
    const rows = this.logic.view.rows$.value;
    const dependencies = this.logic.view.dependencies$.value;

    // Build a map from rowId → bar for quick lookup in dependency rendering
    const barMap = new Map(bars.map(b => [b.rowId, b]));
    // Row index map for y-position calculation
    const rowIndexMap = new Map(rows.map((r, i) => [r.rowId, i]));

    const rowHeight = 36;

    return html`
      <div class=${barsContainerStyle}>
        ${rows.map((row, _i) => {
          const bar = barMap.get(row.rowId);
          const isDragging = this._dragState?.rowId === row.rowId;
          const dragOffset = isDragging ? this._dragState!.currentOffsetPx : 0;
          const effectiveLeft = bar ? bar.leftPx + dragOffset : 0;

          return html`
            <div class=${rowTrackStyle}>
              ${bar
                ? html`
                    <div
                      class=${barStyle}
                      style=${styleMap({
                        left: `${effectiveLeft}px`,
                        width: `${bar.widthPx}px`,
                        opacity: isDragging ? '0.75' : '1',
                      })}
                      title=${this.logic.view.rowTitle(row.rowId)}
                      @mousedown=${(e: MouseEvent) => {
                        e.stopPropagation();
                        this.startBarDrag(row.rowId, bar.leftPx, e);
                      }}
                      @click=${(e: MouseEvent) => {
                        e.stopPropagation();
                        this.logic.openRow(row.rowId);
                      }}
                    >
                      ${bar.widthPx > 40
                        ? this.logic.view.rowTitle(row.rowId)
                        : ''}
                    </div>
                  `
                : ''}
            </div>
          `;
        })}

        <!-- α-TL-3: SVG dependency arrows overlay -->
        ${dependencies.length > 0
          ? html`
              <svg
                style=${styleMap({
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  overflow: 'visible',
                })}
              >
                ${dependencies.map(dep => {
                  const fromBar = barMap.get(dep.fromRowId);
                  const toBar = barMap.get(dep.toRowId);
                  const fromIdx = rowIndexMap.get(dep.fromRowId);
                  const toIdx = rowIndexMap.get(dep.toRowId);
                  if (
                    !fromBar ||
                    !toBar ||
                    fromIdx === undefined ||
                    toIdx === undefined
                  ) {
                    return '';
                  }

                  const x1 = fromBar.leftPx + fromBar.widthPx; // right edge of from bar
                  const y1 = fromIdx * rowHeight + rowHeight / 2; // vertical center of from row
                  const x2 = toBar.leftPx; // left edge of to bar
                  const y2 = toIdx * rowHeight + rowHeight / 2; // vertical center of to row

                  return html`
                    <path
                      d="M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}"
                      fill="none"
                      stroke="var(--affine-text-secondary-color, #888)"
                      stroke-width="1.5"
                      stroke-dasharray="4 2"
                      marker-end="url(#tl-arrow)"
                    ></path>
                  `;
                })}
                <!-- Arrow marker definition -->
                <defs>
                  <marker
                    id="tl-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="3"
                    refY="3"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L6,3 L0,6 Z"
                      fill="var(--affine-text-secondary-color, #888)"
                    />
                  </marker>
                </defs>
              </svg>
            `
          : ''}
      </div>
    `;
  }

  override render(): TemplateResult {
    const startColId = this.logic.view.startDateColumnId$.value;

    if (!startColId) {
      return html`
        ${renderUniLit(this.logic.root.config.headerWidget, {
          dataViewLogic: this.logic,
        })}
        ${this.renderHeader()}
        <div class=${noStartDateHintStyle}>
          This timeline view has no start date column configured.<br />
          Add a property of type <strong>Date</strong> to this database and it
          will be picked automatically, or reconfigure the view.
        </div>
      `;
    }

    const rows = this.logic.view.rows$.value;

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this.renderHeader()}
      <div class=${timelineBodyStyle}>
        <!-- Left panel: row labels -->
        <div class=${leftPanelStyle}>
          <div class=${leftPanelHeaderStyle}>Name</div>
          <div class=${leftPanelBodyStyle}>
            ${rows.map(
              row => html`
                <div
                  class=${leftPanelRowStyle}
                  title=${this.logic.view.rowTitle(row.rowId)}
                  @click=${() => this.logic.openRow(row.rowId)}
                >
                  ${this.logic.view.rowTitle(row.rowId) || 'Untitled'}
                </div>
              `
            )}
          </div>
        </div>

        <!-- Right panel: date axis + bars -->
        <div class=${rightPanelStyle}>
          ${this.renderDateAxis()} ${this.renderBars()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-timeline': TimelineViewUI;
  }
}
