import { Switch } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { useAppUpdater } from '@affine/core/components/hooks/use-app-updater';
import { UrlService } from '@affine/core/modules/url';
import { appIconMap, appNames } from '@affine/core/utils/channel';
import { useI18n } from '@affine/i18n';
import { ArrowRightSmallIcon, OpenInNewIcon } from '@blocksuite/icons/rc';
import { useServices } from '@toeverything/infra';
import { useCallback } from 'react';

import { useAppSettingHelper } from '../../../../../components/hooks/affine/use-app-setting-helper';
import { relatedLinks } from './config';
import * as styles from './style.css';
import { UpdateCheckSection } from './update-check-section';

export const AboutAffine = () => {
  const t = useI18n();
  const { appSettings, updateSettings } = useAppSettingHelper();
  const { toggleAutoCheck, toggleAutoDownload } = useAppUpdater();
  const channel = BUILD_CONFIG.appBuildType;
  const appIcon = appIconMap[channel];
  const appName = appNames[channel];
  const { urlService } = useServices({
    UrlService,
  });

  const onSwitchAutoCheck = useCallback(
    (checked: boolean) => {
      toggleAutoCheck(checked);
      updateSettings('autoCheckUpdate', checked);
    },
    [toggleAutoCheck, updateSettings]
  );

  const onSwitchAutoDownload = useCallback(
    (checked: boolean) => {
      toggleAutoDownload(checked);
      updateSettings('autoDownloadUpdate', checked);
    },
    [toggleAutoDownload, updateSettings]
  );

  const onSwitchTelemetry = useCallback(
    (checked: boolean) => {
      updateSettings('enableTelemetry', checked);
    },
    [updateSettings]
  );

  const currentOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://gogocash.ai';

  return (
    <>
      <SettingHeader
        title="About Superflow"
        subtitle="Built for focused execution, fast collaboration, and reliable delivery."
        data-testid="about-title"
      />
      <SettingWrapper title="Version">
        <SettingRow
          name={appName}
          desc={BUILD_CONFIG.appVersion}
          className={styles.appImageRow}
        >
          <img src={appIcon} alt={appName} width={56} height={56} />
        </SettingRow>
        <SettingRow name="Editor version" desc={BUILD_CONFIG.editorVersion} />
        {BUILD_CONFIG.isElectron ? (
          <>
            <UpdateCheckSection />
            <SettingRow
              name={t['com.affine.aboutAFFiNE.autoCheckUpdate.title']()}
              desc={t['com.affine.aboutAFFiNE.autoCheckUpdate.description']()}
            >
              <Switch
                checked={appSettings.autoCheckUpdate}
                onChange={onSwitchAutoCheck}
              />
            </SettingRow>
            <SettingRow
              name={t['com.affine.aboutAFFiNE.autoDownloadUpdate.title']()}
              desc={t[
                'com.affine.aboutAFFiNE.autoDownloadUpdate.description'
              ]()}
            >
              <Switch
                checked={appSettings.autoDownloadUpdate}
                onChange={onSwitchAutoDownload}
              />
            </SettingRow>
            <SettingRow
              name={t['com.affine.aboutAFFiNE.changelog.title']()}
              desc={t['com.affine.aboutAFFiNE.changelog.description']()}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                urlService.openPopupWindow(BUILD_CONFIG.changelogUrl);
              }}
            >
              <ArrowRightSmallIcon />
            </SettingRow>
          </>
        ) : null}
        <SettingRow
          name="Improve Superflow with telemetry"
          desc="Help us improve speed and reliability by sharing anonymous usage signals."
        >
          <Switch
            checked={appSettings.enableTelemetry !== false}
            onChange={onSwitchTelemetry}
          />
        </SettingRow>
      </SettingWrapper>
      <SettingWrapper title="Contact">
        <a
          className={styles.link}
          rel="noreferrer"
          href={currentOrigin}
          target="_blank"
        >
          Official website
          <OpenInNewIcon className="icon" />
        </a>
        <a
          className={styles.link}
          rel="noreferrer"
          href="https://github.com/mygogocash/Superflow/discussions"
          target="_blank"
        >
          Superflow community
          <OpenInNewIcon className="icon" />
        </a>
      </SettingWrapper>
      <SettingWrapper title="Communities">
        <div className={styles.communityWrapper}>
          {relatedLinks.map(({ icon, title, link }) => {
            return (
              <div
                className={styles.communityItem}
                onClick={() => {
                  if (link.startsWith('mailto:')) {
                    window.location.href = link;
                    return;
                  }
                  urlService.openPopupWindow(link);
                }}
                key={title}
              >
                {icon}
                <p>{title}</p>
              </div>
            );
          })}
        </div>
      </SettingWrapper>
      <SettingWrapper title="Legal info">
        <a
          className={styles.link}
          rel="noreferrer"
          href="https://gogocash.ai/privacy"
          target="_blank"
        >
          Privacy
          <OpenInNewIcon className="icon" />
        </a>
        <a
          className={styles.link}
          rel="noreferrer"
          href="https://gogocash.ai/terms"
          target="_blank"
        >
          Terms of service
          <OpenInNewIcon className="icon" />
        </a>
      </SettingWrapper>
    </>
  );
};
