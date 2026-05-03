import { createIcon } from '../../core/utils/uni-icon.js';
import { formViewModel } from './define.js';
import { FormViewUILogic } from './pc/form-view-ui-logic.js';

export const formViewMeta = formViewModel.createMeta({
  icon: createIcon('DatabaseDocumentIcon'),
  // @ts-expect-error fixme: typesafe
  pcLogic: () => FormViewUILogic,
  // @ts-expect-error fixme: typesafe
  mobileLogic: () => FormViewUILogic,
});
