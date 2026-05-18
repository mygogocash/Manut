import { useI18n } from '@affine/i18n';

import { EmptyTagsIllustration } from './illustrations';
import { EmptyLayout } from './layout';
import type { UniversalEmptyProps } from './types';

export const EmptyTags = (props: UniversalEmptyProps) => {
  const t = useI18n();

  return (
    <EmptyLayout
      illustration={<EmptyTagsIllustration />}
      title={t['com.affine.empty.tags.title']()}
      description={t['com.affine.empty.tags.description']()}
      {...props}
    />
  );
};
