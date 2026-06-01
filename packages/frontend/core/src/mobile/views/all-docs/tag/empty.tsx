import type { Tag } from '@affine/core/modules/tag';
import { useI18n } from '@affine/i18n';
import { EdgelessIcon } from '@blocksuite/icons/rc';

import * as emptyStyles from '../../../pages/workspace/home.css';
import { TagDetailHeader } from './detail-header';

export const TagEmpty = ({ tag }: { tag: Tag }) => {
  const t = useI18n();
  return (
    <>
      <TagDetailHeader tag={tag} />
      <div className={emptyStyles.emptySurface} data-testid="tag-empty">
        <span className={emptyStyles.emptySurfaceIcon}>
          <EdgelessIcon />
        </span>
        <h2 className={emptyStyles.emptySurfaceTitle}>
          {t['com.manut.mobile.empty.docs.title']()}
        </h2>
        <p className={emptyStyles.emptySurfaceCopy}>
          {t['com.manut.mobile.empty.tag.description']()}
        </p>
      </div>
    </>
  );
};
