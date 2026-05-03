import {
  insertPositionToIndex,
  type InsertToPosition,
} from '@blocksuite/affine-shared/utils';
import { computed, signal } from '@preact/signals-core';

import { evalFilter } from '../../core/filter/eval.js';
import { generateDefaultValues } from '../../core/filter/generate-default-values.js';
import { FilterTrait, filterTraitKey } from '../../core/filter/trait.js';
import type { FilterGroup } from '../../core/filter/types.js';
import { emptyFilterGroup } from '../../core/filter/utils.js';
import { fromJson } from '../../core/property/utils.js';
import { PropertyBase } from '../../core/view-manager/property.js';
import { SingleViewBase } from '../../core/view-manager/single-view.js';
import type { ViewManager } from '../../core/view-manager/view-manager.js';
import type { ChartViewColumn, ChartViewData } from './define.js';

type ChartColumnData = ChartViewData['columns'][number];

/** A single data point in the computed chart dataset. */
export type ChartDataPoint = {
  /** The x-axis label (grouping value). */
  label: string;
  /**
   * Map from yAxisColumnId → aggregated numeric value.
   * When no y-axis columns are configured the special key `_count` holds the
   * row count for that x-group.
   */
  values: Record<string, number>;
};

const materializeColumnsByPropertyIds = (
  columns: ChartViewColumn[],
  propertyIds: string[]
) => {
  const needShow = new Set(propertyIds);
  const result: ChartViewColumn[] = [];

  for (const column of columns) {
    if (needShow.has(column.id)) {
      result.push(column);
      needShow.delete(column.id);
    }
  }
  for (const id of needShow) {
    result.push({ id });
  }
  return result;
};

const materializeChartColumns = (
  columns: ChartViewColumn[],
  propertyIds: string[]
) => {
  const next = materializeColumnsByPropertyIds(columns, propertyIds);
  const unchanged =
    columns.length === next.length &&
    columns.every((c, i) => {
      const n = next[i];
      return n != null && c.id === n.id && c.hide === n.hide;
    });
  return unchanged ? columns : next;
};

export class ChartSingleView extends SingleViewBase<ChartViewData> {
  constructor(viewManager: ViewManager, viewId: string) {
    super(viewManager, viewId);
    this.materializeColumns();
  }

  // ─── Required abstract overrides ──────────────────────────────────────

  propertiesRaw$ = computed(() => {
    const allowed = new Set(this.dataSource.properties$.value);
    const seen = new Set<string>();
    const order: string[] = [];

    this.data$.value?.columns.forEach(c => {
      if (allowed.has(c.id) && !seen.has(c.id)) {
        order.push(c.id);
        seen.add(c.id);
      }
    });
    for (const id of allowed) {
      if (!seen.has(id)) order.push(id);
    }
    return order.map(id => this.propertyGetOrCreate(id));
  });

  properties$ = computed(() => {
    return this.propertiesRaw$.value.filter(p => !p.hide$.value);
  });

  detailProperties$ = computed(() => {
    return this.propertiesRaw$.value.filter(p => p.type$.value !== 'title');
  });

  mainProperties$ = computed(() => {
    return (
      this.data$.value?.header ?? {
        titleColumn: this.propertiesRaw$.value.find(
          p => p.type$.value === 'title'
        )?.id,
        iconColumn: 'type',
      }
    );
  });

  readonly$ = computed(() => {
    return this.manager.readonly$.value;
  });

  get type(): string {
    return this.view?.mode ?? 'chart';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): ChartColumn {
    return new ChartColumn(this, propertyId);
  }

  // ─── Filter wiring ────────────────────────────────────────────────────

  filter$ = computed<FilterGroup>(
    () => this.data$.value?.filter ?? emptyFilterGroup
  );

  filterTrait = this.traitSet(
    filterTraitKey,
    new FilterTrait(this.filter$, this, {
      filterSet: filter => {
        this.dataUpdate(() => ({ filter }));
      },
    })
  );

  isShow(rowId: string): boolean {
    if (this.filter$.value?.conditions.length) {
      const rowMap = Object.fromEntries(
        this.propertiesRaw$.value.map(column => [
          column.id,
          column.cellGetOrCreate(rowId).jsonValue$.value,
        ])
      );
      return evalFilter(this.filter$.value, rowMap);
    }
    return true;
  }

  // ─── Chart-specific API ───────────────────────────────────────────────

  /** Current chart type. */
  chartType$ = computed(
    () => this.data$.value?.chartType ?? ('bar' as const)
  );

  setChartType(type: 'bar' | 'line' | 'pie') {
    this.dataUpdate(() => ({ chartType: type }));
  }

  /** Property id used for x-axis grouping. */
  xAxisColumnId$ = computed(() => this.data$.value?.xAxisColumnId);

  setXAxisColumnId(id: string | undefined) {
    this.dataUpdate(() => ({ xAxisColumnId: id }));
  }

  /** α-CHART-3: property ids for y-axis (multi-series). */
  yAxisColumnIds$ = computed(() => this.data$.value?.yAxisColumnIds ?? []);

  setYAxisColumnIds(ids: string[]) {
    this.dataUpdate(() => ({ yAxisColumnIds: ids }));
  }

  /**
   * α-CHART-2: tracks the currently clicked x-value for click-to-filter.
   * null means nothing is selected.
   */
  activeFilter$ = signal<string | null>(null);

  /**
   * Computed chart dataset.
   *
   * Groups `rows$.value` by x-axis property value.  For each group:
   * - If yAxisColumnIds is non-empty → sum numeric cell values for each y-axis property.
   * - Otherwise → count rows per group (key `_count`).
   *
   * Returns `Array<ChartDataPoint>` sorted by label.
   */
  chartData$ = computed((): ChartDataPoint[] => {
    const xColId = this.xAxisColumnId$.value;
    const yColIds = this.yAxisColumnIds$.value;

    const rows = this.rows$.value;
    const groups = new Map<string, string[]>();

    if (xColId) {
      const xProp = this.propertyGetOrCreate(xColId);
      for (const row of rows) {
        if (!this.isShow(row.rowId)) continue;
        const raw = xProp.cellGetOrCreate(row.rowId).jsonValue$.value;
        const label = raw != null ? String(raw) : '(empty)';
        const existing = groups.get(label);
        if (existing) {
          existing.push(row.rowId);
        } else {
          groups.set(label, [row.rowId]);
        }
      }
    } else {
      // No x-axis column: treat every row as one group labelled "All".
      const allIds = rows
        .filter(row => this.isShow(row.rowId))
        .map(row => row.rowId);
      groups.set('All', allIds);
    }

    const result: ChartDataPoint[] = [];

    for (const [label, rowIds] of groups) {
      const values: Record<string, number> = {};

      if (yColIds.length > 0) {
        for (const yColId of yColIds) {
          const yProp = this.propertyGetOrCreate(yColId);
          let sum = 0;
          for (const rowId of rowIds) {
            const raw = yProp.cellGetOrCreate(rowId).jsonValue$.value;
            const num = typeof raw === 'number' ? raw : Number(raw);
            if (!Number.isNaN(num)) {
              sum += num;
            }
          }
          values[yColId] = sum;
        }
      } else {
        values['_count'] = rowIds.length;
      }

      result.push({ label, values });
    }

    result.sort((a, b) => a.label.localeCompare(b.label));
    return result;
  });

  /** Rows that match the currently selected x-value (α-CHART-2 click-to-filter). */
  filteredRows$ = computed(() => {
    const xValue = this.activeFilter$.value;
    if (xValue === null) return [];

    const xColId = this.xAxisColumnId$.value;
    const rows = this.rows$.value;

    if (!xColId) {
      return rows.filter(row => this.isShow(row.rowId)).map(row => row.rowId);
    }

    const xProp = this.propertyGetOrCreate(xColId);
    return rows
      .filter(row => {
        if (!this.isShow(row.rowId)) return false;
        const raw = xProp.cellGetOrCreate(row.rowId).jsonValue$.value;
        const label = raw != null ? String(raw) : '(empty)';
        return label === xValue;
      })
      .map(row => row.rowId);
  });

  /**
   * Add a new row and populate any default values implied by the active filter.
   */
  addRowWithDefaults(position: InsertToPosition = 'end'): string {
    const id = this.rowAdd(position);
    const filter = this.filter$.value;
    if (filter.conditions.length > 0) {
      const defaults = generateDefaultValues(filter, this.vars$.value);
      Object.entries(defaults).forEach(([propertyId, jsonValue]) => {
        const property = this.propertyGetOrCreate(propertyId);
        const propertyMeta = property.meta$.value;
        if (!propertyMeta) return;
        const value = fromJson(propertyMeta.config, {
          value: jsonValue,
          data: property.data$.value,
          dataSource: this.dataSource,
        });
        property.cellGetOrCreate(id).valueSet(value);
      });
    }
    return id;
  }

  // ─── Materialise stored columns vs live property set ──────────────────

  private materializeColumns() {
    const view = this.view;
    if (!view) return;
    const next = materializeChartColumns(
      view.columns,
      this.dataSource.properties$.value
    );
    if (next === view.columns) return;
    this.dataUpdate(() => ({ columns: next }));
  }
}

// ─── Concrete Property class ──────────────────────────────────────────────

export class ChartColumn extends PropertyBase {
  constructor(
    public chartView: ChartSingleView,
    propertyId: string
  ) {
    super(chartView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    this.chartView.dataUpdate(view => {
      const idx = view.columns.findIndex(v => v.id === this.id);
      if (idx < 0) return {};
      const columns = [...view.columns];
      const [col] = columns.splice(idx, 1);
      if (!col) return {};
      const target = insertPositionToIndex(position, columns);
      columns.splice(target, 0, col);
      return { columns };
    });
  }

  override hideSet(hide: boolean): void {
    this.viewDataUpdate(data => ({ ...data, hide }));
  }

  hide$ = computed(() => {
    const fromView = this.viewData$.value?.hide;
    if (fromView != null) return fromView;
    const defaultShow = this.meta$.value?.config.fixed?.defaultShow;
    if (defaultShow != null) return !defaultShow;
    return false;
  });

  viewData$ = computed(() => {
    return this.chartView.data$.value?.columns.find(v => v.id === this.id);
  });

  viewDataUpdate(
    updater: (viewData: ChartColumnData) => Partial<ChartColumnData>
  ) {
    this.chartView.dataUpdate(view => {
      const idx = view.columns.findIndex(v => v.id === this.id);
      if (idx < 0) return {};
      const columns = [...view.columns];
      const cur = columns[idx];
      if (!cur) return {};
      columns[idx] = { ...cur, ...updater(cur) };
      return { columns };
    });
  }
}
