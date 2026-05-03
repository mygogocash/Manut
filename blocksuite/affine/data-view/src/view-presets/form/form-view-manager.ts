import {
  insertPositionToIndex,
  type InsertToPosition,
} from '@blocksuite/affine-shared/utils';
import { computed } from '@preact/signals-core';

import { evalFilter } from '../../core/filter/eval.js';
import { FilterTrait, filterTraitKey } from '../../core/filter/trait.js';
import type { FilterGroup } from '../../core/filter/types.js';
import { emptyFilterGroup } from '../../core/filter/utils.js';
import { PropertyBase } from '../../core/view-manager/property.js';
import { SingleViewBase } from '../../core/view-manager/single-view.js';
import type { ViewManager } from '../../core/view-manager/view-manager.js';
import type { FormViewColumn, FormViewData } from './define.js';

type FormColumnData = FormViewData['columns'][number];

const materializeFormColumnsByPropertyIds = (
  columns: FormViewColumn[],
  propertyIds: string[]
) => {
  const needShow = new Set(propertyIds);
  const result: FormViewColumn[] = [];

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

export const materializeFormColumns = (
  columns: FormViewColumn[],
  propertyIds: string[]
) => {
  const next = materializeFormColumnsByPropertyIds(columns, propertyIds);
  const unchanged =
    columns.length === next.length &&
    columns.every((c, i) => {
      const n = next[i];
      return (
        n != null &&
        c.id === n.id &&
        c.hide === n.hide &&
        c.required === n.required
      );
    });
  return unchanged ? columns : next;
};

export class FormSingleView extends SingleViewBase<FormViewData> {
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
    return this.view?.mode ?? 'form';
  }

  get view() {
    return this.data$.value;
  }

  propertyGetOrCreate(propertyId: string): FormColumn {
    return new FormColumn(this, propertyId);
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

  // ─── Form-specific API ────────────────────────────────────────────────

  /** All form columns (including hidden) */
  formColumns$ = computed(() => this.data$.value?.columns ?? []);

  /** Form title */
  formTitle$ = computed(() => this.data$.value?.title ?? '');

  setFormTitle(title: string) {
    this.dataUpdate(() => ({ title }));
  }

  /** Form description */
  formDescription$ = computed(() => this.data$.value?.description ?? '');

  setFormDescription(description: string) {
    this.dataUpdate(() => ({ description }));
  }

  /** α-FORM-2: Update the required state of a column */
  setColumnRequired(colId: string, required: boolean) {
    this.dataUpdate(view => {
      const idx = view.columns.findIndex(c => c.id === colId);
      if (idx < 0) return {};
      const columns = [...view.columns];
      const cur = columns[idx];
      if (!cur) return {};
      columns[idx] = { ...cur, required };
      return { columns };
    });
  }

  /** α-FORM-3: Whether the form accepts public submissions */
  isPublic$ = computed(() => this.data$.value?.isPublic ?? false);

  setPublic(isPublic: boolean) {
    this.dataUpdate(() => ({ isPublic }));
  }

  /** α-FORM-3: Unique slug for public URL */
  formId$ = computed(() => this.data$.value?.formId);

  setFormId(formId: string) {
    this.dataUpdate(() => ({ formId }));
  }

  // ─── Materialise stored columns vs live property set ──────────────────

  private materializeColumns() {
    const view = this.view;
    if (!view) return;
    const next = materializeFormColumns(
      view.columns,
      this.dataSource.properties$.value
    );
    if (next === view.columns) return;
    this.dataUpdate(() => ({ columns: next }));
  }
}

// ─── Concrete Property class ─────────────────────────────────────────────

export class FormColumn extends PropertyBase {
  constructor(
    public formView: FormSingleView,
    propertyId: string
  ) {
    super(formView as any, propertyId);
  }

  override move(position: InsertToPosition): void {
    this.formView.dataUpdate(view => {
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

  required$ = computed(() => {
    return this.viewData$.value?.required ?? false;
  });

  label$ = computed(() => {
    return this.viewData$.value?.label;
  });

  viewData$ = computed(() => {
    return this.formView.data$.value?.columns.find(v => v.id === this.id);
  });

  viewDataUpdate(
    updater: (viewData: FormColumnData) => Partial<FormColumnData>
  ) {
    this.formView.dataUpdate(view => {
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
