import { useThemeColorV2 } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { InformationIcon } from '@blocksuite/icons/rc';
import { Link } from 'react-router-dom';

import * as styles from './404.css';

export const Component = () => {
  useThemeColorV2('layer/background/mobile/primary');
  const t = useI18n();

  return (
    <main className={styles.page} data-testid="mobile-404">
      <span className={styles.icon}>
        <InformationIcon />
      </span>
      <h1 className={styles.title}>{t['com.manut.mobile.notFound.title']()}</h1>
      <p className={styles.copy}>
        {t['com.manut.mobile.notFound.description']()}
      </p>
      <Link to="/" className={styles.action} data-testid="mobile-404-home">
        {t['com.manut.mobile.notFound.backHome']()}
      </Link>
    </main>
  );
};
