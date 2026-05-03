import { type InsertToPosition } from '@blocksuite/affine-shared/utils';
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
import type { DashboardCell, DashboardViewData } from './define.js';

export class DashboardSingleView extends SingleViewBase<DashboardViewData> {
  constructor(viewManager: ViewManager, viewId: string) {
    super(viewManager, viewId);
  }

  // ─── Required abstract overrides ──────────────────────────────────────

  propertiesRaw$ = computed(() => {
    const allowed = new Set(this.dataSource.properties$.value);
    const seen = new Set<string>();
    const order: string[] = [];

    for (const id of allowed) {
      if (!seen.has(id)) {
        order.push(id);
        seen.add(id);
      }
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
    return {
      titleColumn: this.propertiesRaw$.value.find(
        p => p.type$.value === 'title'
      )?.id,
      iconColumn: 'type',
    };
  });

  readonly$ = computed(() => {
    return this.manager.readonly$.value;
  });

  get type(): string {
    return this.view?.mode ?? 'dashboard';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): DashboardColumn {
    return new DashboardColumn(this, propertyId);
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

  // ─── Dashboard-specific API ───────────────────────────────────────────

  /** All dashboard cells. */
  cells$ = computed(() => this.data$.value?.cells ?? []);

  /** Number of grid columns (default 12). */
  gridCols$ = computed(() => this.data$.value?.gridCols ?? 12);

  /** Add a new cell with a generated id. */
  addCell(cell: Omit<DashboardCell, 'id'>): void {
    const id = generateCellId();
    this.dataUpdate(view => ({
      cells: [...(view.cells ?? []), { ...cell, id }],
    }));
  }

  /** Update a cell by id. */
  updateCell(id: string, changes: Partial<DashboardCell>): void {
    this.dataUpdate(view => {
      const cells = (view.cells ?? []).map(c =>
        c.id === id ? { ...c, ...changes } : c
      );
      return { cells };
    });
  }

  /** Remove a cell by id. */
  removeCell(id: string): void {
    this.dataUpdate(view => ({
      cells: (view.cells ?? []).filter(c => c.id !== id),
    }));
  }

  /** Replace all cells (used for drag/resize batch updates). */
  setCells(cells: DashboardCell[]): void {
    this.dataUpdate(() => ({ cells }));
  }

  /**
   * Add a new row with default values implied by the active filter.
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
}

// ─── Concrete Property class ─────────────────────────────────────────────

export class DashboardColumn extends PropertyBase {
  constructor(
    public dashboardView: DashboardSingleView,
    propertyId: string
  ) {
    super(dashboardView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    // Dashboard doesn't have an ordered column list to rearrange.
    // No-op by design — columns are driven by the data source order.
    void position;
  }

  override hideSet(_hide: boolean): void {
    // Dashboard view shows all columns; no per-column hide in MVP.
  }

  hide$ = computed(() => false);

  viewData$ = computed(() => undefined);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
