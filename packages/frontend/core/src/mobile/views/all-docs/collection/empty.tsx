import type { Collection } from '@affine/core/modules/collection';
import { useI18n } from '@affine/i18n';
import { EdgelessIcon } from '@blocksuite/icons/rc';

import * as emptyStyles from '../../../pages/workspace/home.css';
import { DetailHeader } from './detail';

export const EmptyCollection = ({ collection }: { collection: Collection }) => {
  const t = useI18n();
  return (
    <>
      <DetailHeader collection={collection} />
      <div className={emptyStyles.emptySurface} data-testid="collection-empty">
        <span className={emptyStyles.emptySurfaceIcon}>
          <EdgelessIcon />
        </span>
        <h2 className={emptyStyles.emptySurfaceTitle}>
          {t['com.manut.mobile.empty.docs.title']()}
        </h2>
        <p className={emptyStyles.emptySurfaceCopy}>
          {t['com.manut.mobile.empty.collection.description']()}
        </p>
      </div>
    </>
  );
};
