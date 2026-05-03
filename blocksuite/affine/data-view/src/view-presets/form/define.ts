import type { FilterGroup } from '../../core/filter/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { FormSingleView } from './form-view-manager.js';

export const formViewType = viewType('form');

export type FormViewColumn = {
  id: string;
  hide?: boolean;
  required?: boolean; // α-FORM-2: whether field is required
  label?: string; // optional override label
};

type DataType = {
  columns: FormViewColumn[];
  filter: FilterGroup;
  header: { titleColumn?: string; iconColumn?: string };
  title?: string; // Form title
  description?: string; // Form description shown to submitters
  isPublic?: boolean; // α-FORM-3: whether form accepts public submissions
  formId?: string; // unique slug for public URL
};

export type FormViewData = BasicViewDataType<typeof formViewType.type, DataType>;

export const formViewModel = formViewType.createModel<FormViewData>({
  defaultName: 'Form View',
  dataViewManager: FormSingleView,
  defaultData: viewManager => {
    const allProps = viewManager.dataSource.properties$.value;
    const titleColumn = allProps.find(
      id => viewManager.dataSource.propertyTypeGet(id) === 'title'
    );
    return {
      columns: allProps.map(id => ({ id })),
      filter: { type: 'group', op: 'and', conditions: [] },
      header: { titleColumn, iconColumn: 'type' },
      isPublic: false,
    };
  },
});
