import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { css } from '@emotion/css';
import { computed, signal } from '@preact/signals-core';
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
import type { ChartSingleView } from '../chart-view-manager.js';
import type { ChartViewSelectionWithType } from '../selection.js';

// ─── palette ──────────────────────────────────────────────────────────────────
// 10 distinct colours for multi-series bars / pie slices
const SERIES_COLORS = [
  '#4f8ef7',
  '#f76b4f',
  '#4fca7a',
  '#f7c44f',
  '#9b4ff7',
  '#4ff7e3',
  '#f74fa3',
  '#a3f74f',
  '#f79b4f',
  '#4f9bf7',
];

// ─── Emotion CSS styles ────────────────────────────────────────────────────────

const chartViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  font-size: 14px;
  box-sizing: border-box;
`;

const headerStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
`;

const headerGroupStyle = css`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const labelStyle = css`
  font-size: 12px;
  color: var(--affine-text-secondary-color, #888);
`;

const selectStyle = css`
  font-size: 13px;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 4px;
  padding: 2px 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
`;

const typeToggleStyle = css`
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
    padding: 3px 10px;
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
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.1));
    font-weight: 600;
  }
`;

const addRowBtnStyle = css`
  margin-left: auto;
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const bodyStyle = css`
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
`;

const chartAreaStyle = css`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const svgContainerStyle = css`
  width: 100%;
  flex: 1;
`;

const legendStyle = css`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const legendItemStyle = css`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
`;

const legendSwatchStyle = (color: string) => css`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${color};
  flex-shrink: 0;
`;

const detailPanelStyle = css`
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--affine-border-color, #e3e3e3);
  padding-left: 12px;
  overflow-y: auto;
`;

const detailHeaderStyle = css`
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
`;

const detailRowStyle = css`
  padding: 4px 6px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const emptyHintStyle = css`
  padding: 24px;
  border: 1px dashed var(--affine-border-color, #e3e3e3);
  color: var(--affine-text-secondary-color, #888);
  border-radius: 8px;
  text-align: center;
`;

// ─── SVG chart dimensions ─────────────────────────────────────────────────────
const SVG_WIDTH = 600;
const SVG_HEIGHT = 320;
const MARGIN = { top: 20, right: 20, bottom: 50, left: 50 };
const CHART_W = SVG_WIDTH - MARGIN.left - MARGIN.right;
const CHART_H = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
const GRID_LINES = 5;

// ─── UI Logic ─────────────────────────────────────────────────────────────────

export class ChartViewUILogic extends DataViewUILogicBase<
  ChartSingleView,
  ChartViewSelectionWithType
> {
  ui$ = signal<ChartViewUI | undefined>();

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = (_position: InsertToPosition) => {
    if (this.view.readonly$.value) return undefined;
    const rowId = this.view.addRowWithDefaults('end');
    if (rowId) {
      this.root.openDetailPanel({ view: this.view, rowId });
    }
    return rowId;
  };

  focusFirstCell = () => {
    // Not applicable for chart view.
  };

  showIndicator = (_evt: MouseEvent) => false;

  hideIndicator = () => {
    /* no-op */
  };

  moveTo = (_id: string, _evt: MouseEvent) => {
    /* no-op */
  };

  /** Toggle x-value selection for click-to-filter (α-CHART-2). */
  selectXValue = (xValue: string) => {
    const current = this.view.activeFilter$.value;
    this.view.activeFilter$.value = current === xValue ? null : xValue;
  };

  renderer = createUniComponentFromWebComponent(ChartViewUI);

  /** Convenient computed: property list for pickers. */
  propertyOptions$ = computed(() => {
    return this.view.propertiesRaw$.value.map(p => ({
      id: p.id,
      name: p.name$.value,
    }));
  });
}

// ─── Lit element ──────────────────────────────────────────────────────────────

export class ChartViewUI extends DataViewUIBase<ChartViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(chartViewStyle);
  }

  // ─── Header ───────────────────────────────────────────────────────────

  private renderHeader(): TemplateResult {
    const chartType = this.logic.view.chartType$.value;
    const xColId = this.logic.view.xAxisColumnId$.value ?? '';
    const yColIds = this.logic.view.yAxisColumnIds$.value;
    const props = this.logic.propertyOptions$.value;

    return html`
      <div class=${headerStyle}>
        <!-- Chart type toggle -->
        <div class=${typeToggleStyle}>
          <button
            class=${chartType === 'bar' ? 'active' : ''}
            @click=${() => this.logic.view.setChartType('bar')}
          >
            Bar
          </button>
          <button
            class=${chartType === 'line' ? 'active' : ''}
            @click=${() => this.logic.view.setChartType('line')}
          >
            Line
          </button>
          <button
            class=${chartType === 'pie' ? 'active' : ''}
            @click=${() => this.logic.view.setChartType('pie')}
          >
            Pie
          </button>
        </div>

        <!-- X-axis picker -->
        <div class=${headerGroupStyle}>
          <span class=${labelStyle}>X-axis:</span>
          <select
            class=${selectStyle}
            .value=${xColId}
            @change=${(e: Event) => {
              const val = (e.target as HTMLSelectElement).value;
              this.logic.view.setXAxisColumnId(val || undefined);
            }}
          >
            <option value="">— none —</option>
            ${props.map(
              p =>
                html`<option value=${p.id} ?selected=${p.id === xColId}>
                  ${p.name}
                </option>`
            )}
          </select>
        </div>

        <!-- Y-axis picker (α-CHART-3: multi-select) -->
        <div class=${headerGroupStyle}>
          <span class=${labelStyle}>Y-axis:</span>
          <select
            class=${selectStyle}
            multiple
            size="1"
            @change=${(e: Event) => {
              const select = e.target as HTMLSelectElement;
              const selected = Array.from(select.selectedOptions).map(
                o => o.value
              );
              this.logic.view.setYAxisColumnIds(selected);
            }}
          >
            ${props.map(
              p =>
                html`<option
                  value=${p.id}
                  ?selected=${yColIds.includes(p.id)}
                >
                  ${p.name}
                </option>`
            )}
          </select>
        </div>

        <!-- New row button -->
        ${!this.logic.view.readonly$.value
          ? html`<button
              class=${addRowBtnStyle}
              @click=${() => this.logic.addRow('end')}
            >
              + New row
            </button>`
          : ''}
      </div>
    `;
  }

  // ─── SVG Bar chart (α-CHART-1) ────────────────────────────────────────

  private renderBarChart(): TemplateResult {
    const data = this.logic.view.chartData$.value;
    const yColIds = this.logic.view.yAxisColumnIds$.value;
    const seriesKeys =
      yColIds.length > 0 ? yColIds : ['_count'];
    const activeFilter = this.logic.view.activeFilter$.value;
    const props = this.logic.propertyOptions$.value;

    if (data.length === 0) {
      return html`<div class=${emptyHintStyle}>
        No data to display. Add rows or configure the X-axis property.
      </div>`;
    }

    const maxVal = data.reduce((m, d) => {
      const total = seriesKeys.reduce(
        (s, k) => Math.max(s, d.values[k] ?? 0),
        0
      );
      return Math.max(m, total);
    }, 0) || 1;

    const bandWidth = CHART_W / data.length;
    const seriesW = bandWidth / seriesKeys.length;
    const barPad = Math.max(2, seriesW * 0.15);

    // Grid lines
    const gridLines = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
      const y = CHART_H - (i / GRID_LINES) * CHART_H;
      const val = ((i / GRID_LINES) * maxVal).toFixed(0);
      return { y, val };
    });

    // Legend labels
    const legendItems = seriesKeys.map((k, i) => {
      const name =
        k === '_count'
          ? 'Count'
          : (props.find(p => p.id === k)?.name ?? k);
      return { name, color: SERIES_COLORS[i % SERIES_COLORS.length] ?? '#4f8ef7' };
    });

    return html`
      <div class=${chartAreaStyle}>
        <svg
          class=${svgContainerStyle}
          viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform="translate(${MARGIN.left},${MARGIN.top})">
            <!-- Grid lines -->
            ${gridLines.map(
              gl => html`
                <line
                  x1="0"
                  y1=${gl.y}
                  x2=${CHART_W}
                  y2=${gl.y}
                  stroke="var(--affine-border-color,#e3e3e3)"
                  stroke-dasharray="4 3"
                />
                <text
                  x="-6"
                  y=${gl.y + 4}
                  text-anchor="end"
                  font-size="11"
                  fill="var(--affine-text-secondary-color,#888)"
                >
                  ${gl.val}
                </text>
              `
            )}
            <!-- Axes -->
            <line
              x1="0"
              y1=${CHART_H}
              x2=${CHART_W}
              y2=${CHART_H}
              stroke="var(--affine-text-secondary-color,#888)"
            />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2=${CHART_H}
              stroke="var(--affine-text-secondary-color,#888)"
            />
            <!-- Bars per group -->
            ${data.map((point, gi) => {
              const isSelected = activeFilter === point.label;
              const groupX = gi * bandWidth;

              return html`${seriesKeys.map((key, si) => {
                const raw = point.values[key] ?? 0;
                const barH = (raw / maxVal) * CHART_H;
                const barX = groupX + si * seriesW + barPad / 2;
                const barY = CHART_H - barH;
                const color =
                  SERIES_COLORS[si % SERIES_COLORS.length] ?? '#4f8ef7';
                const fill = isSelected ? shadeColor(color, -30) : color;
                const stroke = isSelected ? '#222' : 'none';

                return html`
                  <rect
                    x=${barX}
                    y=${barY}
                    width=${Math.max(0, seriesW - barPad)}
                    height=${barH}
                    fill=${fill}
                    stroke=${stroke}
                    stroke-width="1.5"
                    rx="2"
                    style="transition: height 0.3s ease, y 0.3s ease; cursor: pointer;"
                    @click=${() => this.logic.selectXValue(point.label)}
                  >
                    <title>${point.label}: ${raw}</title>
                  </rect>
                `;
              })}
              <!-- X label -->
              <text
                x=${groupX + bandWidth / 2}
                y=${CHART_H + 16}
                text-anchor="middle"
                font-size="11"
                fill="var(--affine-text-secondary-color,#888)"
              >
                ${truncate(point.label, 10)}
              </text>`;
            })}
          </g>
        </svg>
        <!-- Legend (α-CHART-3) -->
        ${legendItems.length > 1
          ? html`<div class=${legendStyle}>
              ${legendItems.map(
                li => html`
                  <div class=${legendItemStyle}>
                    <div class=${legendSwatchStyle(li.color)}></div>
                    <span>${li.name}</span>
                  </div>
                `
              )}
            </div>`
          : ''}
      </div>
    `;
  }

  // ─── SVG Line chart ───────────────────────────────────────────────────

  private renderLineChart(): TemplateResult {
    const data = this.logic.view.chartData$.value;
    const yColIds = this.logic.view.yAxisColumnIds$.value;
    const seriesKeys = yColIds.length > 0 ? yColIds : ['_count'];
    const props = this.logic.propertyOptions$.value;

    if (data.length === 0) {
      return html`<div class=${emptyHintStyle}>
        No data to display.
      </div>`;
    }

    const maxVal = data.reduce((m, d) => {
      const total = seriesKeys.reduce(
        (s, k) => Math.max(s, d.values[k] ?? 0),
        0
      );
      return Math.max(m, total);
    }, 0) || 1;

    const xStep = data.length > 1 ? CHART_W / (data.length - 1) : CHART_W / 2;

    const gridLines = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
      const y = CHART_H - (i / GRID_LINES) * CHART_H;
      const val = ((i / GRID_LINES) * maxVal).toFixed(0);
      return { y, val };
    });

    const legendItems = seriesKeys.map((k, i) => ({
      name: k === '_count' ? 'Count' : (props.find(p => p.id === k)?.name ?? k),
      color: SERIES_COLORS[i % SERIES_COLORS.length] ?? '#4f8ef7',
    }));

    return html`
      <div class=${chartAreaStyle}>
        <svg
          class=${svgContainerStyle}
          viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform="translate(${MARGIN.left},${MARGIN.top})">
            ${gridLines.map(
              gl => html`
                <line
                  x1="0"
                  y1=${gl.y}
                  x2=${CHART_W}
                  y2=${gl.y}
                  stroke="var(--affine-border-color,#e3e3e3)"
                  stroke-dasharray="4 3"
                />
                <text
                  x="-6"
                  y=${gl.y + 4}
                  text-anchor="end"
                  font-size="11"
                  fill="var(--affine-text-secondary-color,#888)"
                >
                  ${gl.val}
                </text>
              `
            )}
            <line
              x1="0"
              y1=${CHART_H}
              x2=${CHART_W}
              y2=${CHART_H}
              stroke="var(--affine-text-secondary-color,#888)"
            />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2=${CHART_H}
              stroke="var(--affine-text-secondary-color,#888)"
            />
            ${seriesKeys.map((key, si) => {
              const color =
                SERIES_COLORS[si % SERIES_COLORS.length] ?? '#4f8ef7';
              const points = data.map((point, gi) => {
                const val = point.values[key] ?? 0;
                const cx =
                  data.length > 1 ? gi * xStep : CHART_W / 2;
                const cy = CHART_H - (val / maxVal) * CHART_H;
                return { cx, cy, label: point.label, val };
              });
              const polylinePoints = points
                .map(p => `${p.cx},${p.cy}`)
                .join(' ');

              return html`
                <polyline
                  points=${polylinePoints}
                  fill="none"
                  stroke=${color}
                  stroke-width="2.5"
                  stroke-linejoin="round"
                />
                ${points.map(
                  p => html`
                    <circle
                      cx=${p.cx}
                      cy=${p.cy}
                      r="5"
                      fill=${color}
                      stroke="white"
                      stroke-width="1.5"
                      style="cursor: pointer;"
                      @click=${() => this.logic.selectXValue(p.label)}
                    >
                      <title>${p.label}: ${p.val}</title>
                    </circle>
                  `
                )}
              `;
            })}
            <!-- X labels -->
            ${data.map(
              (point, gi) => html`
                <text
                  x=${data.length > 1 ? gi * xStep : CHART_W / 2}
                  y=${CHART_H + 16}
                  text-anchor="middle"
                  font-size="11"
                  fill="var(--affine-text-secondary-color,#888)"
                >
                  ${truncate(point.label, 10)}
                </text>
              `
            )}
          </g>
        </svg>
        ${legendItems.length > 1
          ? html`<div class=${legendStyle}>
              ${legendItems.map(
                li => html`
                  <div class=${legendItemStyle}>
                    <div class=${legendSwatchStyle(li.color)}></div>
                    <span>${li.name}</span>
                  </div>
                `
              )}
            </div>`
          : ''}
      </div>
    `;
  }

  // ─── SVG Pie chart ────────────────────────────────────────────────────

  private renderPieChart(): TemplateResult {
    const data = this.logic.view.chartData$.value;
    const yColIds = this.logic.view.yAxisColumnIds$.value;
    const primaryKey =
      yColIds.length > 0 ? (yColIds[0] ?? '_count') : '_count';
    const activeFilter = this.logic.view.activeFilter$.value;

    if (data.length === 0) {
      return html`<div class=${emptyHintStyle}>
        No data to display.
      </div>`;
    }

    const total = data.reduce((s, d) => s + (d.values[primaryKey] ?? 0), 0) || 1;

    const CX = 150;
    const CY = 150;
    const R = 120;
    const PIE_SVG_W = 320;
    const PIE_SVG_H = 320;

    let angle = -Math.PI / 2; // start at top
    const slices = data.map((point, i) => {
      const val = point.values[primaryKey] ?? 0;
      const sweep = (val / total) * 2 * Math.PI;
      const startAngle = angle;
      angle += sweep;
      const endAngle = angle;
      const color = SERIES_COLORS[i % SERIES_COLORS.length] ?? '#4f8ef7';
      const isSelected = activeFilter === point.label;
      const outerR = isSelected ? R + 8 : R;

      // SVG arc path
      const x1 = CX + outerR * Math.cos(startAngle);
      const y1 = CY + outerR * Math.sin(startAngle);
      const x2 = CX + outerR * Math.cos(endAngle);
      const y2 = CY + outerR * Math.sin(endAngle);
      const largeArc = sweep > Math.PI ? 1 : 0;

      const d =
        `M ${CX} ${CY} ` +
        `L ${x1} ${y1} ` +
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} ` +
        `Z`;

      // Label position (midpoint of arc)
      const midAngle = startAngle + sweep / 2;
      const labelR = outerR * 0.65;
      const lx = CX + labelR * Math.cos(midAngle);
      const ly = CY + labelR * Math.sin(midAngle);
      const pct = ((val / total) * 100).toFixed(0);

      return { d, color, isSelected, label: point.label, val, lx, ly, pct };
    });

    return html`
      <div class=${chartAreaStyle}>
        <svg
          class=${svgContainerStyle}
          viewBox="0 0 ${PIE_SVG_W} ${PIE_SVG_H}"
          preserveAspectRatio="xMidYMid meet"
        >
          ${slices.map(
            s => html`
              <path
                d=${s.d}
                fill=${s.isSelected ? shadeColor(s.color, -30) : s.color}
                stroke=${s.isSelected ? '#222' : 'white'}
                stroke-width=${s.isSelected ? '2' : '1'}
                style="cursor: pointer; transition: all 0.2s ease;"
                @click=${() => this.logic.selectXValue(s.label)}
              >
                <title>${s.label}: ${s.val} (${s.pct}%)</title>
              </path>
              ${Number(s.pct) >= 5
                ? html`<text
                    x=${s.lx}
                    y=${s.ly}
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="11"
                    fill="white"
                    pointer-events="none"
                  >
                    ${s.pct}%
                  </text>`
                : ''}
            `
          )}
        </svg>
        <!-- Pie legend -->
        <div class=${legendStyle}>
          ${slices.map(
            s => html`
              <div class=${legendItemStyle}>
                <div class=${legendSwatchStyle(s.color)}></div>
                <span>${truncate(s.label, 16)} (${s.val})</span>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  // ─── α-CHART-2 detail panel ───────────────────────────────────────────

  private renderDetailPanel(): TemplateResult {
    const xValue = this.logic.view.activeFilter$.value;
    if (xValue === null) return html``;

    const rowIds = this.logic.view.filteredRows$.value;
    const titleColId = this.logic.view.view?.header.titleColumn;

    return html`
      <div class=${detailPanelStyle}>
        <div class=${detailHeaderStyle}>
          Filtered: ${xValue}
          <button
            style="font-size:11px; margin-left:6px; cursor:pointer; border:none; background:none; color: inherit;"
            @click=${() => {
              this.logic.view.activeFilter$.value = null;
            }}
          >
            ✕
          </button>
        </div>
        ${rowIds.length === 0
          ? html`<div style="font-size:12px; color: var(--affine-text-secondary-color,#888);">No rows</div>`
          : rowIds.map(rowId => {
              const label = titleColId
                ? (this.logic.view
                    .propertyGetOrCreate(titleColId)
                    .cellGetOrCreate(rowId)
                    .stringValue$.value || 'Untitled')
                : rowId;
              return html`
                <div
                  class=${detailRowStyle}
                  @click=${() => {
                    this.root.openDetailPanel({
                      view: this.logic.view,
                      rowId,
                    });
                  }}
                >
                  ${label}
                </div>
              `;
            })}
      </div>
    `;
  }

  // ─── Main render ──────────────────────────────────────────────────────

  override render(): TemplateResult {
    const chartType = this.logic.view.chartType$.value;
    const hasDetailPanel = this.logic.view.activeFilter$.value !== null;

    let chartContent: TemplateResult;
    if (chartType === 'line') {
      chartContent = this.renderLineChart();
    } else if (chartType === 'pie') {
      chartContent = this.renderPieChart();
    } else {
      chartContent = this.renderBarChart();
    }

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this.renderHeader()}
      <div class=${bodyStyle}>
        ${chartContent}
        ${hasDetailPanel ? this.renderDetailPanel() : ''}
      </div>
    `;
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Darken/lighten a hex colour by `amount` (negative = darker). */
function shadeColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Truncate a string to `max` chars, appending '…' if needed. */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-chart': ChartViewUI;
  }
}
