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
import type { MapViewColumn, MapViewData } from './define.js';

type MapColumnData = MapViewData['columns'][number];

/** A parsed geo-pin for a row. */
export type RowPin = {
  rowId: string;
  lat: number;
  lng: number;
  title: string;
};

const materializeColumnsByPropertyIds = (
  columns: MapViewColumn[],
  propertyIds: string[]
) => {
  const needShow = new Set(propertyIds);
  const result: MapViewColumn[] = [];

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

export const materializeMapColumns = (
  columns: MapViewColumn[],
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

/** Parse a "lat,lng" string. Returns null if invalid. */
function parseLatLng(raw: unknown): { lat: number; lng: number } | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  const comma = str.indexOf(',');
  if (comma < 0) return null;
  const lat = parseFloat(str.slice(0, comma));
  const lng = parseFloat(str.slice(comma + 1));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export class MapSingleView extends SingleViewBase<MapViewData> {
  constructor(viewManager: ViewManager, viewId: string) {
    super(viewManager, viewId);
    this.materializeColumns();
  }

  // ─── Required abstract overrides ────────────────────────────────────────

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
    return this.view?.mode ?? 'map';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): MapColumn {
    return new MapColumn(this, propertyId);
  }

  // ─── Filter wiring ───────────────────────────────────────────────────────

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

  // ─── Map-specific API ────────────────────────────────────────────────────

  /** Property id used to resolve geo-coordinates for each row. */
  geoColumnId$ = computed(() => this.data$.value?.geoColumnId);

  setGeoColumnId(id: string | undefined) {
    this.dataUpdate(() => ({ geoColumnId: id }));
  }

  /** Initial zoom level (1-18). */
  mapZoom$ = computed(() => this.data$.value?.zoom ?? 10);

  setMapZoom(zoom: number) {
    this.dataUpdate(() => ({ zoom: Math.max(1, Math.min(18, zoom)) }));
  }

  /** [lat, lng] center of the map. */
  mapCenter$ = computed<[number, number]>(
    () => this.data$.value?.center ?? [0, 0]
  );

  setMapCenter(center: [number, number]) {
    this.dataUpdate(() => ({ center }));
  }

  /**
   * Computed list of rows that have parseable lat/lng coordinates in the
   * configured geo column. Rows with text values (addresses) are included
   * with lat=NaN so the UI can queue them for geocoding.
   *
   * Format recognised as coordinates: "lat,lng"  e.g. "48.8566,2.3522"
   */
  rowPins$ = computed<RowPin[]>(() => {
    const colId = this.geoColumnId$.value;
    if (!colId) return [];

    const property = this.propertyGetOrCreate(colId);
    const titleColId = this.view?.header.titleColumn;
    const titleProperty = titleColId
      ? this.propertyGetOrCreate(titleColId)
      : null;

    const pins: RowPin[] = [];

    for (const row of this.rows$.value) {
      const rawGeo = property.cellGetOrCreate(row.rowId).jsonValue$.value;
      if (rawGeo == null) continue;

      const coords = parseLatLng(rawGeo);
      if (coords == null) continue;

      const title = titleProperty
        ? (titleProperty.cellGetOrCreate(row.rowId).stringValue$.value ??
            'Untitled')
        : 'Untitled';

      pins.push({ rowId: row.rowId, lat: coords.lat, lng: coords.lng, title });
    }

    return pins;
  });

  /**
   * Like rowPins$ but also returns rows where the geo column contains a
   * non-coordinate text string (potential address). These rows have
   * lat/lng = NaN and need geocoding by the UI layer.
   */
  rowPinsWithAddresses$ = computed<
    (RowPin | { rowId: string; address: string; title: string })[]
  >(() => {
    const colId = this.geoColumnId$.value;
    if (!colId) return [];

    const property = this.propertyGetOrCreate(colId);
    const titleColId = this.view?.header.titleColumn;
    const titleProperty = titleColId
      ? this.propertyGetOrCreate(titleColId)
      : null;

    const result: (RowPin | { rowId: string; address: string; title: string })[] =
      [];

    for (const row of this.rows$.value) {
      const rawGeo = property.cellGetOrCreate(row.rowId).jsonValue$.value;
      if (rawGeo == null) continue;

      const title = titleProperty
        ? (titleProperty.cellGetOrCreate(row.rowId).stringValue$.value ??
            'Untitled')
        : 'Untitled';

      const coords = parseLatLng(rawGeo);
      if (coords != null) {
        result.push({ rowId: row.rowId, lat: coords.lat, lng: coords.lng, title });
      } else {
        const str = String(rawGeo).trim();
        if (str.length > 0) {
          result.push({ rowId: row.rowId, address: str, title });
        }
      }
    }

    return result;
  });

  /** Read the title column's display string for a row. */
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

  // ─── Materialise stored columns vs live property set ────────────────────

  private materializeColumns() {
    const view = this.view;
    if (!view) return;
    const next = materializeMapColumns(
      view.columns,
      this.dataSource.properties$.value
    );
    if (next === view.columns) return;
    this.dataUpdate(() => ({ columns: next }));
  }
}

// ─── Concrete Property class ─────────────────────────────────────────────────

export class MapColumn extends PropertyBase {
  constructor(
    public mapView: MapSingleView,
    propertyId: string
  ) {
    super(mapView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    this.mapView.dataUpdate(view => {
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
    return this.mapView.data$.value?.columns.find(v => v.id === this.id);
  });

  viewDataUpdate(
    updater: (viewData: MapColumnData) => Partial<MapColumnData>
  ) {
    this.mapView.dataUpdate(view => {
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
