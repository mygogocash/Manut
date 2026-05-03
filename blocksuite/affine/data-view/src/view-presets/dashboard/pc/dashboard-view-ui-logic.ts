import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { css } from '@emotion/css';
import { effect, signal } from '@preact/signals-core';
import { type TemplateResult } from 'lit';
import { html } from 'lit/static-html.js';

import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { DashboardSingleView } from '../dashboard-view-manager.js';
import type { DashboardCell } from '../define.js';
import type { DashboardViewSelectionWithType } from '../selection.js';

// ─── styles ───────────────────────────────────────────────────────────────

const dashboardViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  font-size: 14px;
  user-select: none;
`;

const dashboardHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
`;

const dashboardHeaderTitleStyle = css`
  font-weight: 600;
  font-size: 18px;
`;

const addCellButtonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const dashboardGridStyle = css`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 80px;
  gap: 8px;
  position: relative;
  padding: 16px;
  min-height: 300px;
`;

const dashboardCellStyle = css`
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: var(--affine-background-primary-color, #fff);
  display: flex;
  flex-direction: column;
`;

const cellHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.02));
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  cursor: grab;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
`;

const cellBodyStyle = css`
  flex: 1;
  overflow: hidden;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const resizeHandleStyle = css`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 2px;

  &::after {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--affine-text-secondary-color, #999);
    border-bottom: 2px solid var(--affine-text-secondary-color, #999);
    border-radius: 0 0 2px 0;
  }
`;

const removeCellButtonStyle = css`
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--affine-text-secondary-color, #888);
  padding: 0 2px;
  font-size: 14px;
  line-height: 1;
  &:hover {
    color: var(--affine-error-color, #e00);
  }
`;

const summaryValueStyle = css`
  font-size: 36px;
  font-weight: 700;
  color: var(--affine-text-primary-color, #111);
`;

const summaryLabelStyle = css`
  font-size: 12px;
  color: var(--affine-text-secondary-color, #888);
  margin-top: 4px;
`;

const summaryWrapStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const emptyDashboardStyle = css`
  padding: 48px 24px;
  text-align: center;
  color: var(--affine-text-secondary-color, #888);
  border: 2px dashed var(--affine-border-color, #e3e3e3);
  border-radius: 12px;
  margin: 24px;
`;

// ─── Add cell modal styles ────────────────────────────────────────────────

const modalOverlayStyle = css`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const modalStyle = css`
  background: var(--affine-background-primary-color, #fff);
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 12px;
  padding: 24px;
  width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const modalTitleStyle = css`
  font-size: 16px;
  font-weight: 600;
  margin: 0;
`;

const modalFieldStyle = css`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    color: var(--affine-text-secondary-color, #888);
    font-weight: 500;
  }

  select,
  input {
    padding: 6px 8px;
    border: 1px solid var(--affine-border-color, #e3e3e3);
    border-radius: 6px;
    font-size: 13px;
    background: var(--affine-background-primary-color, #fff);
    color: inherit;
  }
`;

const typeToggleStyle = css`
  display: flex;
  gap: 8px;

  button {
    flex: 1;
    appearance: none;
    border: 1px solid var(--affine-border-color, #e3e3e3);
    background: transparent;
    color: inherit;
    border-radius: 6px;
    padding: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  button.active {
    background: var(--affine-primary-color, #1e90ff);
    color: #fff;
    border-color: var(--affine-primary-color, #1e90ff);
  }
`;

const modalActionsStyle = css`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
`;

const modalCancelStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
`;

const modalAddStyle = css`
  appearance: none;
  border: none;
  background: var(--affine-primary-color, #1e90ff);
  color: #fff;
  border-radius: 6px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
`;

// ─── UI logic ─────────────────────────────────────────────────────────────

export class DashboardViewUILogic extends DataViewUILogicBase<
  DashboardSingleView,
  DashboardViewSelectionWithType
> {
  ui$ = signal<DashboardViewUI | undefined>();

  /** Controls whether the "add cell" modal is open. */
  addCellModalOpen$ = signal(false);

  /** Current cell type selection in the modal. */
  modalCellType$ = signal<'chart' | 'summary' | 'table'>('chart');

  openAddCellModal = () => {
    this.addCellModalOpen$.value = true;
    this.modalCellType$.value = 'chart';
  };

  closeAddCellModal = () => {
    this.addCellModalOpen$.value = false;
  };

  removeCell = (id: string) => {
    this.view.removeCell(id);
  };

  // ─── Required DataViewUILogicBase abstract members ────────────────────

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = (_position: InsertToPosition) => {
    if (this.view.readonly$.value) return undefined;
    return this.view.addRowWithDefaults('end');
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in dashboard MVP.
  };

  showIndicator = (_evt: MouseEvent) => {
    return false;
  };

  hideIndicator = () => {};

  moveTo = (_id: string, _evt: MouseEvent) => {};

  renderer = createUniComponentFromWebComponent(DashboardViewUI);
}

// ─── Lit web component ────────────────────────────────────────────────────

export class DashboardViewUI extends DataViewUIBase<DashboardViewUILogic> {
  /** Drag state for moving a cell. */
  private _dragging: {
    cellId: string;
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
    colWidth: number;
    rowHeight: number;
  } | null = null;

  /** Resize state. */
  private _resizing: {
    cellId: string;
    startMouseX: number;
    startMouseY: number;
    startW: number;
    startH: number;
    colWidth: number;
    rowHeight: number;
  } | null = null;

  private _boundPointerMove: (e: PointerEvent) => void = () => {};
  private _boundPointerUp: (e: PointerEvent) => void = () => {};

  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(dashboardViewStyle);

    // γ-DASH-6: Subscribe to row changes for auto-refresh
    this._disposables.add(
      effect(() => {
        // Touch rows$ to subscribe — re-render when data changes
        const _ = this.logic.view.rows$.value;
        void _;
        this.requestUpdate();
      })
    );

    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp = this._onPointerUp.bind(this);
    window.addEventListener('pointermove', this._boundPointerMove);
    window.addEventListener('pointerup', this._boundPointerUp);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('pointermove', this._boundPointerMove);
    window.removeEventListener('pointerup', this._boundPointerUp);
  }

  // ─── γ-DASH-2: Drag logic ────────────────────────────────────────────

  private _startDrag(e: PointerEvent, cell: DashboardCell): void {
    if (this.logic.view.readonly$.value) return;
    e.preventDefault();
    const grid = this.querySelector(
      `.${dashboardGridStyle}`
    ) as HTMLElement | null;
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();
    const cols = this.logic.view.gridCols$.value;
    const colWidth = gridRect.width / cols;
    const rowHeight = 80; // matches grid-auto-rows

    this._dragging = {
      cellId: cell.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: cell.x,
      startY: cell.y,
      colWidth,
      rowHeight,
    };
  }

  private _startResize(e: PointerEvent, cell: DashboardCell): void {
    if (this.logic.view.readonly$.value) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = this.querySelector(
      `.${dashboardGridStyle}`
    ) as HTMLElement | null;
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();
    const cols = this.logic.view.gridCols$.value;
    const colWidth = gridRect.width / cols;
    const rowHeight = 80;

    this._resizing = {
      cellId: cell.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: cell.w,
      startH: cell.h,
      colWidth,
      rowHeight,
    };
  }

  private _onPointerMove(e: PointerEvent): void {
    if (this._dragging) {
      const d = this._dragging;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      const cols = this.logic.view.gridCols$.value;

      const deltaX = Math.round(dx / d.colWidth);
      const deltaY = Math.round(dy / d.rowHeight);

      const cells = this.logic.view.cells$.value;
      const cell = cells.find(c => c.id === d.cellId);
      if (!cell) return;

      const newX = Math.max(0, Math.min(d.startX + deltaX, cols - cell.w));
      const newY = Math.max(0, d.startY + deltaY);

      if (newX !== cell.x || newY !== cell.y) {
        this.logic.view.updateCell(d.cellId, { x: newX, y: newY });
      }
    }

    if (this._resizing) {
      const r = this._resizing;
      const dx = e.clientX - r.startMouseX;
      const dy = e.clientY - r.startMouseY;
      const cols = this.logic.view.gridCols$.value;

      const deltaW = Math.round(dx / r.colWidth);
      const deltaH = Math.round(dy / r.rowHeight);

      const cells = this.logic.view.cells$.value;
      const cell = cells.find(c => c.id === r.cellId);
      if (!cell) return;

      const newW = Math.max(1, Math.min(r.startW + deltaW, cols - cell.x));
      const newH = Math.max(1, r.startH + deltaH);

      if (newW !== cell.w || newH !== cell.h) {
        this.logic.view.updateCell(r.cellId, { w: newW, h: newH });
      }
    }
  }

  private _onPointerUp(_e: PointerEvent): void {
    this._dragging = null;
    this._resizing = null;
    this.requestUpdate();
  }

  // ─── γ-DASH-3: Add cell wizard ────────────────────────────────────────

  private _submitAddCell(e: SubmitEvent): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);

    const type =
      (data.get('cellType') as 'chart' | 'summary' | 'table') ?? 'chart';
    const title = (data.get('title') as string) || '';

    const cells = this.logic.view.cells$.value;
    const maxY = cells.reduce((m, c) => Math.max(m, c.y + c.h), 0);

    if (type === 'chart') {
      this.logic.view.addCell({
        type: 'chart',
        x: 0,
        y: maxY,
        w: 6,
        h: 4,
        chartType: (data.get('chartType') as 'bar' | 'line' | 'pie') ?? 'bar',
        xAxisColumnId: (data.get('xAxis') as string) || undefined,
        yAxisColumnIds: data.get('yAxis')
          ? [data.get('yAxis') as string]
          : undefined,
        title,
      });
    } else if (type === 'summary') {
      this.logic.view.addCell({
        type: 'summary',
        x: 0,
        y: maxY,
        w: 3,
        h: 2,
        summaryType:
          (data.get('summaryType') as
            | 'count'
            | 'sum'
            | 'avg'
            | 'last-edited') ?? 'count',
        summaryColumnId: (data.get('summaryColumn') as string) || undefined,
        title,
      });
    } else {
      this.logic.view.addCell({
        type: 'table',
        x: 0,
        y: maxY,
        w: 12,
        h: 5,
        title,
      });
    }

    this.logic.closeAddCellModal();
  }

  private _renderAddCellModal(): TemplateResult {
    const type = this.logic.modalCellType$.value;
    const props = this.logic.view.propertiesRaw$.value;
    const numericProps = props.filter(p => {
      const t = p.type$.value;
      return t === 'number' || t === 'progress';
    });

    return html`
      <div
        class=${modalOverlayStyle}
        @click=${(e: MouseEvent) => {
          if (e.target === e.currentTarget) this.logic.closeAddCellModal();
        }}
      >
        <form class=${modalStyle} @submit=${this._submitAddCell.bind(this)}>
          <h3 class=${modalTitleStyle}>Add dashboard cell</h3>

          <div class=${modalFieldStyle}>
            <label>Title</label>
            <input name="title" type="text" placeholder="Optional title" />
          </div>

          <div class=${modalFieldStyle}>
            <label>Cell type</label>
            <div class=${typeToggleStyle}>
              <button
                type="button"
                class=${type === 'chart' ? 'active' : ''}
                @click=${() => {
                  this.logic.modalCellType$.value = 'chart';
                  this.requestUpdate();
                }}
              >
                Chart
              </button>
              <button
                type="button"
                class=${type === 'summary' ? 'active' : ''}
                @click=${() => {
                  this.logic.modalCellType$.value = 'summary';
                  this.requestUpdate();
                }}
              >
                Summary
              </button>
              <button
                type="button"
                class=${type === 'table' ? 'active' : ''}
                @click=${() => {
                  this.logic.modalCellType$.value = 'table';
                  this.requestUpdate();
                }}
              >
                Table
              </button>
            </div>
            <input type="hidden" name="cellType" value=${type} />
          </div>

          ${type === 'chart'
            ? html`
                <div class=${modalFieldStyle}>
                  <label>X axis (category)</label>
                  <select name="xAxis">
                    <option value="">— none —</option>
                    ${props.map(
                      p =>
                        html`<option value=${p.id}>
                          ${p.name$.value || p.id}
                        </option>`
                    )}
                  </select>
                </div>
                <div class=${modalFieldStyle}>
                  <label>Y axis (value)</label>
                  <select name="yAxis">
                    <option value="">— none —</option>
                    ${numericProps.map(
                      p =>
                        html`<option value=${p.id}>
                          ${p.name$.value || p.id}
                        </option>`
                    )}
                  </select>
                </div>
                <div class=${modalFieldStyle}>
                  <label>Chart type</label>
                  <select name="chartType">
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="pie">Pie</option>
                  </select>
                </div>
              `
            : type === 'summary'
              ? html`
                  <div class=${modalFieldStyle}>
                    <label>Summary type</label>
                    <select name="summaryType">
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="last-edited">Last edited</option>
                    </select>
                  </div>
                  <div class=${modalFieldStyle}>
                    <label>Column</label>
                    <select name="summaryColumn">
                      <option value="">— any —</option>
                      ${numericProps.map(
                        p =>
                          html`<option value=${p.id}>
                            ${p.name$.value || p.id}
                          </option>`
                      )}
                    </select>
                  </div>
                `
              : ''}

          <div class=${modalActionsStyle}>
            <button
              type="button"
              class=${modalCancelStyle}
              @click=${this.logic.closeAddCellModal}
            >
              Cancel
            </button>
            <button type="submit" class=${modalAddStyle}>Add</button>
          </div>
        </form>
      </div>
    `;
  }

  // ─── γ-DASH-4: Chart cells ────────────────────────────────────────────

  private _renderChart(cell: DashboardCell): TemplateResult {
    const rows = this.logic.view.rows$.value;
    const chartType = cell.chartType ?? 'bar';

    if (!cell.xAxisColumnId) {
      return html`<div
        style="color: var(--affine-text-secondary-color, #888); font-size: 12px;"
      >
        Configure X axis in settings
      </div>`;
    }

    const xProp = this.logic.view.propertyGetOrCreate(cell.xAxisColumnId);
    const yPropId = cell.yAxisColumnIds?.[0];
    const yProp = yPropId ? this.logic.view.propertyGetOrCreate(yPropId) : null;

    const buckets = new Map<string, number>();
    for (const row of rows) {
      const xVal = String(
        xProp.cellGetOrCreate(row.rowId).stringValue$.value ?? ''
      );
      const yVal = yProp
        ? Number(yProp.cellGetOrCreate(row.rowId).jsonValue$.value ?? 0)
        : 1;
      buckets.set(xVal, (buckets.get(xVal) ?? 0) + (isNaN(yVal) ? 1 : yVal));
    }

    if (buckets.size === 0) {
      return html`<div
        style="color: var(--affine-text-secondary-color, #888); font-size: 12px;"
      >
        No data
      </div>`;
    }

    const entries = [...buckets.entries()].slice(0, 20);
    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

    if (chartType === 'bar') {
      return this._renderBarChart(entries, maxVal);
    } else if (chartType === 'line') {
      return this._renderLineChart(entries, maxVal);
    } else {
      return this._renderPieChart(entries);
    }
  }

  private _renderBarChart(
    entries: [string, number][],
    maxVal: number
  ): TemplateResult {
    const svgW = 300;
    const svgH = 180;
    const pad = { top: 10, right: 10, bottom: 30, left: 30 };
    const chartW = svgW - pad.left - pad.right;
    const chartH = svgH - pad.top - pad.bottom;
    const barW = Math.max(4, (chartW / entries.length) * 0.7);
    const gap = chartW / entries.length;

    return html`
      <svg
        viewBox="0 0 ${svgW} ${svgH}"
        style="width:100%;height:100%;"
        xmlns="http://www.w3.org/2000/svg"
      >
        ${entries.map(([label, val], i) => {
          const barH = (val / maxVal) * chartH;
          const x = pad.left + i * gap + (gap - barW) / 2;
          const y = pad.top + chartH - barH;
          return html`
            <rect
              x=${x}
              y=${y}
              width=${barW}
              height=${barH}
              fill="var(--affine-primary-color, #1e90ff)"
              rx="2"
            ></rect>
            <text
              x=${x + barW / 2}
              y=${svgH - pad.bottom + 12}
              text-anchor="middle"
              font-size="9"
              fill="var(--affine-text-secondary-color, #888)"
            >
              ${label.length > 6 ? label.slice(0, 5) + '…' : label}
            </text>
          `;
        })}
        <line
          x1=${pad.left}
          y1=${pad.top + chartH}
          x2=${svgW - pad.right}
          y2=${pad.top + chartH}
          stroke="var(--affine-border-color, #e3e3e3)"
          stroke-width="1"
        />
      </svg>
    `;
  }

  private _renderLineChart(
    entries: [string, number][],
    maxVal: number
  ): TemplateResult {
    if (entries.length < 2) {
      return this._renderBarChart(entries, maxVal);
    }

    const svgW = 300;
    const svgH = 180;
    const pad = { top: 10, right: 10, bottom: 30, left: 30 };
    const chartW = svgW - pad.left - pad.right;
    const chartH = svgH - pad.top - pad.bottom;

    const pts = entries.map(([, val], i) => {
      const x = pad.left + (i / (entries.length - 1)) * chartW;
      const y = pad.top + chartH - (val / maxVal) * chartH;
      return [x, y] as [number, number];
    });

    const pathD = pts
      .map(
        ([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      )
      .join(' ');

    return html`
      <svg
        viewBox="0 0 ${svgW} ${svgH}"
        style="width:100%;height:100%;"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d=${pathD}
          fill="none"
          stroke="var(--affine-primary-color, #1e90ff)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        ${pts.map(
          ([x, y]) =>
            html`<circle
              cx=${x}
              cy=${y}
              r="3"
              fill="var(--affine-primary-color, #1e90ff)"
            ></circle>`
        )}
        ${entries.map(([label], i) => {
          const [x] = pts[i]!;
          return html`
            <text
              x=${x}
              y=${svgH - pad.bottom + 12}
              text-anchor="middle"
              font-size="9"
              fill="var(--affine-text-secondary-color, #888)"
            >
              ${label.length > 6 ? label.slice(0, 5) + '…' : label}
            </text>
          `;
        })}
        <line
          x1=${pad.left}
          y1=${pad.top + chartH}
          x2=${svgW - pad.right}
          y2=${pad.top + chartH}
          stroke="var(--affine-border-color, #e3e3e3)"
          stroke-width="1"
        />
      </svg>
    `;
  }

  private _renderPieChart(entries: [string, number][]): TemplateResult {
    const svgW = 200;
    const svgH = 180;
    const cx = svgW / 2;
    const cy = svgH / 2;
    const r = Math.min(cx, cy) - 20;
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const colors = [
      '#1e90ff',
      '#ff6b6b',
      '#4ecdc4',
      '#ffe66d',
      '#a8e6cf',
      '#ffaaa5',
      '#b8b8ff',
    ];

    let startAngle = -Math.PI / 2;
    const slices = entries.map(([label, val], i) => {
      const angle = (val / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      startAngle += angle;
      const x2 = cx + r * Math.cos(startAngle);
      const y2 = cy + r * Math.sin(startAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
      return { d, color: colors[i % colors.length]!, label };
    });

    return html`
      <svg
        viewBox="0 0 ${svgW} ${svgH}"
        style="width:100%;height:100%;"
        xmlns="http://www.w3.org/2000/svg"
      >
        ${slices.map(
          ({ d, color, label }) =>
            html`<path d=${d} fill=${color} opacity="0.85">
              <title>${label}</title>
            </path>`
        )}
      </svg>
    `;
  }

  // ─── γ-DASH-5: Summary cells ──────────────────────────────────────────

  private _renderSummary(cell: DashboardCell): TemplateResult {
    const rows = this.logic.view.rows$.value;
    const summaryType = cell.summaryType ?? 'count';

    let value: string | number = '—';
    let label = summaryType;

    if (summaryType === 'count') {
      value = rows.length;
      label = 'Total rows';
    } else if (summaryType === 'sum' && cell.summaryColumnId) {
      const prop = this.logic.view.propertyGetOrCreate(cell.summaryColumnId);
      const sum = rows.reduce((acc, row) => {
        const v = Number(prop.cellGetOrCreate(row.rowId).jsonValue$.value ?? 0);
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
      value = sum % 1 === 0 ? sum : sum.toFixed(2);
      label = `Sum of ${prop.name$.value || cell.summaryColumnId}`;
    } else if (summaryType === 'avg' && cell.summaryColumnId) {
      const prop = this.logic.view.propertyGetOrCreate(cell.summaryColumnId);
      const nums = rows.flatMap(row => {
        const v = Number(prop.cellGetOrCreate(row.rowId).jsonValue$.value ?? 0);
        return isNaN(v) ? [] : [v];
      });
      const avg =
        nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      value = avg % 1 === 0 ? avg : avg.toFixed(2);
      label = `Avg of ${prop.name$.value || cell.summaryColumnId}`;
    } else if (summaryType === 'last-edited') {
      value = rows.length > 0 ? `${rows.length} rows` : '0';
      label = 'Last edited (row count)';
    }

    return html`
      <div class=${summaryWrapStyle}>
        <div class=${summaryValueStyle}>${value}</div>
        <div class=${summaryLabelStyle}>${label}</div>
      </div>
    `;
  }

  // ─── Table cell rendering ─────────────────────────────────────────────

  private _renderTableCell(): TemplateResult {
    const rows = this.logic.view.rows$.value;
    const props = this.logic.view.properties$.value.slice(0, 5);

    return html`
      <table
        style="width:100%;border-collapse:collapse;font-size:11px;overflow:hidden;"
      >
        <thead>
          <tr>
            ${props.map(
              p =>
                html`<th
                  style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--affine-border-color,#e3e3e3);color:var(--affine-text-secondary-color,#888);font-weight:500;"
                >
                  ${p.name$.value || p.id}
                </th>`
            )}
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 10).map(
            row =>
              html`<tr>
                ${props.map(
                  p =>
                    html`<td
                      style="padding:3px 6px;border-bottom:1px solid var(--affine-border-color,#e3e3e3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;"
                    >
                      ${p.cellGetOrCreate(row.rowId).stringValue$.value || ''}
                    </td>`
                )}
              </tr>`
          )}
        </tbody>
      </table>
    `;
  }

  // ─── γ-DASH-1: Grid composition ───────────────────────────────────────

  private _renderDashboardCell(cell: DashboardCell): TemplateResult {
    const gridColumn = `${cell.x + 1} / span ${cell.w}`;
    const gridRow = `${cell.y + 1} / span ${cell.h}`;
    const title =
      cell.title ||
      (cell.type === 'chart'
        ? 'Chart'
        : cell.type === 'summary'
          ? 'Summary'
          : 'Table');

    return html`
      <div
        class=${dashboardCellStyle}
        style="grid-column: ${gridColumn}; grid-row: ${gridRow};"
        data-cell-id=${cell.id}
      >
        <!-- Cell header — drag handle -->
        <div
          class=${cellHeaderStyle}
          @pointerdown=${(e: PointerEvent) => this._startDrag(e, cell)}
        >
          <span>${title}</span>
          <button
            class=${removeCellButtonStyle}
            title="Remove cell"
            @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
            @click=${(e: MouseEvent) => {
              e.stopPropagation();
              this.logic.removeCell(cell.id);
            }}
          >
            ×
          </button>
        </div>

        <!-- Cell body -->
        <div class=${cellBodyStyle}>
          ${cell.type === 'chart'
            ? this._renderChart(cell)
            : cell.type === 'summary'
              ? this._renderSummary(cell)
              : this._renderTableCell()}
        </div>

        <!-- γ-DASH-2: Resize handle -->
        <div
          class=${resizeHandleStyle}
          @pointerdown=${(e: PointerEvent) => this._startResize(e, cell)}
        ></div>
      </div>
    `;
  }

  private _renderGrid(): TemplateResult {
    const cells = this.logic.view.cells$.value;

    if (cells.length === 0) {
      return html`
        <div class=${emptyDashboardStyle}>
          <div style="font-size: 32px; margin-bottom: 12px">📊</div>
          <div style="font-weight: 600; margin-bottom: 6px">No cells yet</div>
          <div style="font-size: 12px;">
            Click "+ Add cell" to create charts, summaries, or tables
          </div>
        </div>
      `;
    }

    return html`
      <div class=${dashboardGridStyle}>
        ${cells.map(cell => this._renderDashboardCell(cell))}
      </div>
    `;
  }

  private _renderHeader(): TemplateResult {
    return html`
      <div class=${dashboardHeaderStyle}>
        <div class=${dashboardHeaderTitleStyle}>Dashboard</div>
        <button
          class=${addCellButtonStyle}
          @click=${this.logic.openAddCellModal}
        >
          + Add cell
        </button>
      </div>
    `;
  }

  override render(): TemplateResult {
    const modalOpen = this.logic.addCellModalOpen$.value;

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this._renderHeader()} ${this._renderGrid()}
      ${modalOpen ? this._renderAddCellModal() : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-dashboard': DashboardViewUI;
  }
}
