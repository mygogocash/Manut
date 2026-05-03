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
import type { GalleryViewColumn, GalleryViewData } from './define.js';

type GalleryColumnData = GalleryViewData['columns'][number];

// ─── α-GAL-1: Cover image extraction ─────────────────────────────────────────

/**
 * Extract a cover image URL from a raw property value.
 * Handles: plain URL strings, text with embedded URLs, arrays, and objects
 * with `url`, `src`, or nested `file.url` fields.
 */
export function extractCoverUrl(rawValue: unknown): string | null {
  if (rawValue == null) return null;
  if (typeof rawValue === 'string') {
    if (rawValue.startsWith('http://') || rawValue.startsWith('https://'))
      return rawValue;
    const urlMatch = rawValue.match(/https?:\/\/\S+/);
    return urlMatch ? urlMatch[0] : null;
  }
  if (Array.isArray(rawValue) && rawValue.length > 0) {
    return extractCoverUrl(rawValue[0]);
  }
  if (typeof rawValue === 'object') {
    const obj = rawValue as Record<string, unknown>;
    if (typeof obj['url'] === 'string') return obj['url'];
    if (typeof obj['src'] === 'string') return obj['src'];
    if (
      obj['file'] &&
      typeof (obj['file'] as Record<string, unknown>)['url'] === 'string'
    ) {
      return (obj['file'] as Record<string, unknown>)['url'] as string;
    }
  }
  return null;
}

// ─── Column materialisation helper ────────────────────────────────────────────

const materializeColumnsByPropertyIds = (
  columns: GalleryViewColumn[],
  propertyIds: string[]
) => {
  const needShow = new Set(propertyIds);
  const result: GalleryViewColumn[] = [];

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

export const materializeGalleryColumns = (
  columns: GalleryViewColumn[],
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

// ─── Main view class ──────────────────────────────────────────────────────────

export class GallerySingleView extends SingleViewBase<GalleryViewData> {
  constructor(viewManager: ViewManager, viewId: string) {
    super(viewManager, viewId);
    this.materializeColumns();
  }

  // ─── Required abstract overrides ──────────────────────────────────────────

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
    return 'gallery';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): GalleryColumn {
    return new GalleryColumn(this, propertyId);
  }

  // ─── Filter wiring ────────────────────────────────────────────────────────

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

  // ─── Gallery-specific API ─────────────────────────────────────────────────

  /** Property id used to derive the card cover image (α-GAL-1). */
  coverImageColumnId$ = computed(() => this.data$.value?.coverImageColumnId);

  setCoverImageColumnId(id: string | undefined) {
    this.dataUpdate(() => ({ coverImageColumnId: id }));
  }

  /** Card size preset (α-GAL-2). Defaults to 'md'. */
  cardSize$ = computed(() => this.data$.value?.cardSize ?? 'md');

  setCardSize(size: 'sm' | 'md' | 'lg') {
    this.dataUpdate(() => ({ cardSize: size }));
  }

  /**
   * Return the cover image URL for a given row (α-GAL-1).
   * Reads the configured coverImageColumnId property and extracts a URL.
   */
  rowCoverUrl(rowId: string): string | null {
    const colId = this.coverImageColumnId$.value;
    if (!colId) return null;
    const property = this.propertyGetOrCreate(colId);
    const rawValue = property.cellGetOrCreate(rowId).jsonValue$.value;
    return extractCoverUrl(rawValue);
  }

  /** Read the title column's display string for a row, or fallback. */
  rowTitle(rowId: string): string {
    const titleColId = this.view?.header.titleColumn;
    if (!titleColId) return 'Untitled';
    const property = this.propertyGetOrCreate(titleColId);
    return property.cellGetOrCreate(rowId).stringValue$.value || 'Untitled';
  }

  /**
   * Add a new row + populate any default values implied by the active filter.
   * Mirrors CalendarSingleView.addRowWithDefaults.
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

  // ─── Materialise stored columns vs live property set ──────────────────────

  private materializeColumns() {
    const view = this.view;
    if (!view) return;
    const next = materializeGalleryColumns(
      view.columns,
      this.dataSource.properties$.value
    );
    if (next === view.columns) return;
    this.dataUpdate(() => ({ columns: next }));
  }
}

// ─── Concrete Property class ──────────────────────────────────────────────────

export class GalleryColumn extends PropertyBase {
  constructor(
    public galleryView: GallerySingleView,
    propertyId: string
  ) {
    super(galleryView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    this.galleryView.dataUpdate(view => {
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
    return this.galleryView.data$.value?.columns.find(v => v.id === this.id);
  });

  viewDataUpdate(
    updater: (viewData: GalleryColumnData) => Partial<GalleryColumnData>
  ) {
    this.galleryView.dataUpdate(view => {
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
