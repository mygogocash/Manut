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
import type { FeedViewColumn, FeedViewData } from './define.js';

type FeedColumnData = FeedViewData['columns'][number];

const materializeFeedColumnsByPropertyIds = (
  columns: FeedViewColumn[],
  propertyIds: string[]
) => {
  const needShow = new Set(propertyIds);
  const result: FeedViewColumn[] = [];

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

export const materializeFeedColumns = (
  columns: FeedViewColumn[],
  propertyIds: string[]
) => {
  const next = materializeFeedColumnsByPropertyIds(columns, propertyIds);
  const unchanged =
    columns.length === next.length &&
    columns.every((c, i) => {
      const n = next[i];
      return n != null && c.id === n.id && c.hide === n.hide;
    });
  return unchanged ? columns : next;
};

export class FeedSingleView extends SingleViewBase<FeedViewData> {
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
    return this.view?.mode ?? 'feed';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): FeedColumn {
    return new FeedColumn(this, propertyId);
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

  // ─── α-FEED-2: Date-range filter ──────────────────────────────────────

  dateRangeFilter$ = computed(
    () => this.data$.value?.dateRangeFilter ?? 'alltime'
  );

  setDateRangeFilter(range: 'last7days' | 'last30days' | 'alltime') {
    this.dataUpdate(() => ({ dateRangeFilter: range }));
  }

  // ─── α-FEED-1: Page size ──────────────────────────────────────────────

  pageSize$ = computed(() => this.data$.value?.pageSize ?? 50);

  setPageSize(n: number) {
    this.dataUpdate(() => ({ pageSize: n }));
  }

  // ─── α-FEED-2: filteredRows$ ─────────────────────────────────────────
  // Applies base filter first, then the date-range filter on top.

  filteredRows$ = computed(() => {
    const range = this.dateRangeFilter$.value;
    const now = Date.now();

    const cutoff: number =
      range === 'last7days'
        ? now - 7 * 86400000
        : range === 'last30days'
          ? now - 30 * 86400000
          : 0; // alltime — no cutoff

    // Find the first date-typed column to use for range filtering
    const datePropId = this.propertiesRaw$.value.find(
      p => p.type$.value === 'date'
    )?.id;

    return this.rows$.value.filter(row => {
      // Apply base filter
      if (!this.isShow(row.rowId)) return false;

      // Apply date-range filter (only when not alltime and a date column exists)
      if (cutoff > 0 && datePropId) {
        const property = this.propertyGetOrCreate(datePropId);
        const raw = property.cellGetOrCreate(row.rowId).jsonValue$.value;
        if (raw == null) return false;
        const ms =
          typeof raw === 'number' ? raw : Date.parse(String(raw));
        if (Number.isNaN(ms)) return false;
        if (ms < cutoff) return false;
      }

      return true;
    });
  });

  // ─── Row helpers ──────────────────────────────────────────────────────

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

  // ─── Materialise stored columns vs live property set ──────────────────

  private materializeColumns() {
    const view = this.view;
    if (!view) return;
    const next = materializeFeedColumns(
      view.columns,
      this.dataSource.properties$.value
    );
    if (next === view.columns) return;
    this.dataUpdate(() => ({ columns: next }));
  }
}

// ─── Concrete Property class ──────────────────────────────────────────────

export class FeedColumn extends PropertyBase {
  constructor(
    public feedView: FeedSingleView,
    propertyId: string
  ) {
    super(feedView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    this.feedView.dataUpdate(view => {
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
    return this.feedView.data$.value?.columns.find(v => v.id === this.id);
  });

  viewDataUpdate(
    updater: (viewData: FeedColumnData) => Partial<FeedColumnData>
  ) {
    this.feedView.dataUpdate(view => {
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
