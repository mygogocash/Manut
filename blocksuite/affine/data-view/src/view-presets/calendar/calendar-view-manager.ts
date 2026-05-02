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
import type { CalendarViewColumn, CalendarViewData } from './define.js';

type CalendarColumnData = CalendarViewData['columns'][number];

const materializeColumnsByPropertyIds = (
  columns: CalendarViewColumn[],
  propertyIds: string[]
) => {
  const needShow = new Set(propertyIds);
  const result: CalendarViewColumn[] = [];

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

export const materializeCalendarColumns = (
  columns: CalendarViewColumn[],
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

export class CalendarSingleView extends SingleViewBase<CalendarViewData> {
  constructor(viewManager: ViewManager, viewId: string) {
    super(viewManager, viewId);
    // Reconcile stored column list against the live property set on activation,
    // mirroring KanbanSingleView.
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
    return this.view?.mode ?? 'calendar';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): CalendarColumn {
    return new CalendarColumn(this, propertyId);
  }

  // ─── Filter wiring (parity with Kanban) ───────────────────────────────

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

  // ─── Calendar-specific API ────────────────────────────────────────────

  /** Property id of the date column driving the calendar axis. */
  dateColumnId$ = computed(() => this.data$.value?.dateColumnId);

  setDateColumnId(propertyId: string | undefined) {
    this.dataUpdate(() => ({ dateColumnId: propertyId }));
  }

  /** Display mode (month/week/day). MVP renders month only. */
  displayMode$ = computed(() => this.data$.value?.displayMode ?? 'month');

  setDisplayMode(mode: 'month' | 'week' | 'day') {
    this.dataUpdate(() => ({ displayMode: mode }));
  }

  /** Map of YYYY-MM-DD → ordered rowIds, computed from the configured date column. */
  rowsByDay$ = computed(() => {
    const colId = this.dateColumnId$.value;
    const map = new Map<string, string[]>();
    if (!colId) return map;

    const property = this.propertyGetOrCreate(colId);

    for (const row of this.rows$.value) {
      const raw = property.cellGetOrCreate(row.rowId).jsonValue$.value;
      if (raw == null) continue;
      const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
      if (Number.isNaN(ms)) continue;
      const d = new Date(ms);
      // Local-date key so events show on the day the user sees in their TZ.
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const existing = map.get(key);
      if (existing) existing.push(row.rowId);
      else map.set(key, [row.rowId]);
    }
    return map;
  });

  /**
   * Set the date column's value for a row. Used when adding a row by clicking a day cell.
   * `epochMs` is local-time noon so the event shows on the clicked day across TZs.
   */
  setRowDate(rowId: string, epochMs: number) {
    const colId = this.dateColumnId$.value;
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

  /**
   * Add a new row + populate any default values implied by the active filter
   * (mirrors Kanban's addCard behaviour).
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
    const next = materializeCalendarColumns(
      view.columns,
      this.dataSource.properties$.value
    );
    if (next === view.columns) return;
    this.dataUpdate(() => ({ columns: next }));
  }
}

// ─── Concrete Property class ─────────────────────────────────────────────
// Mirror of Kanban's KanbanColumn; needed because PropertyBase is abstract.

export class CalendarColumn extends PropertyBase {
  constructor(
    public calendarView: CalendarSingleView,
    propertyId: string
  ) {
    super(calendarView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    this.calendarView.dataUpdate(view => {
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
    return this.calendarView.data$.value?.columns.find(v => v.id === this.id);
  });

  viewDataUpdate(
    updater: (viewData: CalendarColumnData) => Partial<CalendarColumnData>
  ) {
    this.calendarView.dataUpdate(view => {
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
