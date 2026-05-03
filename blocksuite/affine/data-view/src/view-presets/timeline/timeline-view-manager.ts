import {
  insertPositionToIndex,
  type InsertToPosition,
} from '@blocksuite/affine-shared/utils';
import { computed } from '@preact/signals-core';

import { evalFilter } from '../../core/filter/eval.js';
import { generateDefaultValues } from '../../core/filter/generate-default-values.js';
import { FilterTrait, filterTraitKey } from '../../core/filter/trait.js';
import type { FilterGroup } from '../../core/filter/types.js';
import { emptyFilterGroup } from '../../core/filter/utils.js';
import { fromJson } from '../../core/property/utils.js';
import { PropertyBase } from '../../core/view-manager/property.js';
import { SingleViewBase } from '../../core/view-manager/single-view.js';
import type { ViewManager } from '../../core/view-manager/view-manager.js';
import type { TimelineViewColumn, TimelineViewData } from './define.js';

type TimelineColumnData = TimelineViewData['columns'][number];

const PIXELS_PER_DAY_MAP = {
  week: 80,
  month: 40,
  quarter: 12,
  year: 3,
} as const;

type ZoomLevel = 'week' | 'month' | 'quarter' | 'year';

export interface RowBar {
  rowId: string;
  startMs: number;
  endMs: number;
  leftPx: number;
  widthPx: number;
}

export interface DependencyEdge {
  fromRowId: string;
  toRowId: string;
}

const materializeColumnsByPropertyIds = (
  columns: TimelineViewColumn[],
  propertyIds: string[]
) => {
  const needShow = new Set(propertyIds);
  const result: TimelineViewColumn[] = [];

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

const materializeTimelineColumns = (
  columns: TimelineViewColumn[],
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

export class TimelineSingleView extends SingleViewBase<TimelineViewData> {
  constructor(viewManager: ViewManager, viewId: string) {
    super(viewManager, viewId);
    this.materializeColumns();
  }

  // ─── Required abstract overrides ─────────────────────────────────────

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
    return this.view?.mode ?? 'timeline';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): TimelineColumn {
    return new TimelineColumn(this, propertyId);
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

  // ─── Timeline-specific API ────────────────────────────────────────────

  /** Property id of the start date column. */
  startDateColumnId$ = computed(() => this.data$.value?.startDateColumnId);

  setStartDateColumnId(id: string | undefined) {
    this.dataUpdate(() => ({ startDateColumnId: id }));
  }

  /** Property id of the end date column (α-TL-2). */
  endDateColumnId$ = computed(() => this.data$.value?.endDateColumnId);

  setEndDateColumnId(id: string | undefined) {
    this.dataUpdate(() => ({ endDateColumnId: id }));
  }

  /** Property id of the dependency column (α-TL-3). */
  dependencyColumnId$ = computed(() => this.data$.value?.dependencyColumnId);

  setDependencyColumnId(id: string | undefined) {
    this.dataUpdate(() => ({ dependencyColumnId: id }));
  }

  /** Zoom level (α-TL-4). */
  zoomLevel$ = computed<ZoomLevel>(
    () => this.data$.value?.zoomLevel ?? 'month'
  );

  setZoomLevel(level: ZoomLevel) {
    this.dataUpdate(() => ({ zoomLevel: level }));
  }

  /** Epoch ms of the left edge of the viewport. */
  viewStartDate$ = computed(
    () => this.data$.value?.viewStartDate ?? Date.now() - 7 * 86400000
  );

  setViewStartDate(epochMs: number) {
    this.dataUpdate(() => ({ viewStartDate: epochMs }));
  }

  /** Pixels per day based on zoom level. */
  pixelsPerDay$ = computed(() => {
    return PIXELS_PER_DAY_MAP[this.zoomLevel$.value];
  });

  /**
   * Computed bars for each row. For each row, compute leftPx and widthPx
   * based on start/end date columns and pixelsPerDay.
   * If no end date column or row has no end date, use 24h duration.
   */
  rowBars$ = computed<RowBar[]>(() => {
    const startColId = this.startDateColumnId$.value;
    if (!startColId) return [];

    const endColId = this.endDateColumnId$.value;
    const viewStart = this.viewStartDate$.value;
    const pixelsPerDay = this.pixelsPerDay$.value;
    const msPerPx = (24 * 3600 * 1000) / pixelsPerDay;

    const startProp = this.propertyGetOrCreate(startColId);
    const endProp = endColId ? this.propertyGetOrCreate(endColId) : null;

    const result: RowBar[] = [];

    for (const row of this.rows$.value) {
      const rawStart = startProp
        .cellGetOrCreate(row.rowId)
        .jsonValue$.value;
      if (rawStart == null) continue;

      const msStart =
        typeof rawStart === 'number'
          ? rawStart
          : Date.parse(String(rawStart));
      if (Number.isNaN(msStart)) continue;

      let msEnd: number;
      if (endProp) {
        const rawEnd = endProp
          .cellGetOrCreate(row.rowId)
          .jsonValue$.value;
        if (rawEnd != null) {
          const parsed =
            typeof rawEnd === 'number'
              ? rawEnd
              : Date.parse(String(rawEnd));
          msEnd = Number.isNaN(parsed)
            ? msStart + 24 * 3600 * 1000
            : Math.max(msStart + 3600 * 1000, parsed);
        } else {
          msEnd = msStart + 24 * 3600 * 1000;
        }
      } else {
        msEnd = msStart + 24 * 3600 * 1000;
      }

      const leftPx = (msStart - viewStart) / msPerPx;
      const widthPx = Math.max(4, (msEnd - msStart) / msPerPx);

      result.push({ rowId: row.rowId, startMs: msStart, endMs: msEnd, leftPx, widthPx });
    }

    return result;
  });

  /**
   * Computed dependency edges (α-TL-3). Reads the dependencyColumnId property
   * for each row and returns pairs of { fromRowId, toRowId }.
   * Expects the property value to be a comma/newline separated list of row IDs.
   */
  dependencies$ = computed<DependencyEdge[]>(() => {
    const depColId = this.dependencyColumnId$.value;
    if (!depColId) return [];

    const depProp = this.propertyGetOrCreate(depColId);
    const result: DependencyEdge[] = [];
    const allRowIds = new Set(this.rows$.value.map(r => r.rowId));

    for (const row of this.rows$.value) {
      const raw = depProp
        .cellGetOrCreate(row.rowId)
        .jsonValue$.value;
      if (raw == null) continue;

      const rawStr = String(raw);
      // Parse comma or newline separated row IDs
      const targets = rawStr
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && allRowIds.has(s));

      for (const targetId of targets) {
        result.push({ fromRowId: row.rowId, toRowId: targetId });
      }
    }

    return result;
  });

  /**
   * Set the start date column's value for a row.
   * Used for drag-reschedule (α-TL-1).
   */
  setRowDate(rowId: string, epochMs: number) {
    const colId = this.startDateColumnId$.value;
    if (!colId) return;
    const property = this.propertyGetOrCreate(colId);
    const meta = property.meta$.value;
    if (!meta) return;
    const value = fromJson(meta.config, {
      value: epochMs,
      data: property.data$.value,
      dataSource: this.dataSource,
    });
    property.cellGetOrCreate(rowId).valueSet(value);
  }

  /** Read the title column's display string for a row, or fallback. */
  rowTitle(rowId: string): string {
    const titleColId = this.view?.header.titleColumn;
    if (!titleColId) return 'Untitled';
    const property = this.propertyGetOrCreate(titleColId);
    return property.cellGetOrCreate(rowId).stringValue$.value || 'Untitled';
  }

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

  private materializeColumns() {
    const view = this.view;
    if (!view) return;
    const next = materializeTimelineColumns(
      view.columns,
      this.dataSource.properties$.value
    );
    if (next === view.columns) return;
    this.dataUpdate(() => ({ columns: next }));
  }
}

// ─── Concrete Property class ─────────────────────────────────────────────

export class TimelineColumn extends PropertyBase {
  constructor(
    public timelineView: TimelineSingleView,
    propertyId: string
  ) {
    super(timelineView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    this.timelineView.dataUpdate(view => {
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
    return this.timelineView.data$.value?.columns.find(v => v.id === this.id);
  });

  viewDataUpdate(
    updater: (viewData: TimelineColumnData) => Partial<TimelineColumnData>
  ) {
    this.timelineView.dataUpdate(view => {
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
