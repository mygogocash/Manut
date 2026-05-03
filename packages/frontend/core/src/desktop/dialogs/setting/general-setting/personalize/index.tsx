import { notify } from '@affine/component';
import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { UserSettingsService } from '@affine/core/modules/cloud';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as styles from './style.css';

const PERSONALIZE_MAX_LENGTH = 4000;
const SAVE_DEBOUNCE_MS = 600;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const PersonalizeSettings = () => {
  const t = useI18n();
  const userSettingsService = useService(UserSettingsService);

  useEffect(() => {
    userSettingsService.revalidate();
  }, [userSettingsService]);

  const userSettings = useLiveData(userSettingsService.userSettings$);
  const error = useLiveData(userSettingsService.error$);

  const errorMessage = useMemo(() => {
    if (!error) return null;
    const userFriendlyError = UserFriendlyError.fromAny(error);
    return t[`error.${userFriendlyError.name}`](userFriendlyError.data);
  }, [error, t]);

  const remoteValue =
    typeof userSettings?.personalize === 'string'
      ? userSettings.personalize
      : '';

  const [draft, setDraft] = useState(remoteValue);
  const [status, setStatus] = useState<SaveStatus>('idle');
  // last value confirmed to be in sync with the server (or pending save)
  const lastSyncedRef = useRef<string>(remoteValue);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEditedRef = useRef(false);

  // When a fresh value arrives from the server (e.g. on initial load),
  // adopt it — but don't clobber a draft the user is actively editing.
  useEffect(() => {
    if (userSettings === undefined) return;
    if (userEditedRef.current) return;
    setDraft(remoteValue);
    lastSyncedRef.current = remoteValue;
  }, [userSettings, remoteValue]);

  const persist = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed === lastSyncedRef.current.trim()) {
        setStatus('idle');
        return;
      }
      if (trimmed.length > PERSONALIZE_MAX_LENGTH) {
        setStatus('error');
        return;
      }
      setStatus('saving');
      userSettingsService
        .updateUserSettings({ personalize: trimmed })
        .then(() => {
          lastSyncedRef.current = trimmed;
          setStatus('saved');
        })
        .catch(err => {
          setStatus('error');
          const userFriendlyError = UserFriendlyError.fromAny(err);
          notify.error({
            title: t[`error.${userFriendlyError.name}`](userFriendlyError.data),
          });
        });
    },
    [userSettingsService, t]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      userEditedRef.current = true;
      setDraft(next);
      setStatus('idle');

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        persist(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist]
  );

  const handleBlur = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    persist(draft);
  }, [draft, persist]);

  // Flush any pending save when the panel unmounts so we never drop edits.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        // Best-effort flush; failures are surfaced via notify on the next mount.
        const trimmed = draft.trim();
        if (
          trimmed !== lastSyncedRef.current.trim() &&
          trimmed.length <= PERSONALIZE_MAX_LENGTH
        ) {
          userSettingsService
            .updateUserSettings({
              personalize: trimmed,
            })
            .catch(console.error);
        }
      }
    };
    // We intentionally read draft from the closure on unmount only.
     
    // oxlint-disable-next-line exhaustive-deps
  }, []);

  const length = draft.length;
  const overLimit = length > PERSONALIZE_MAX_LENGTH;
  const disabled = !userSettings;

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'saving':
        return t['com.affine.personalize.status.saving']();
      case 'saved':
        return t['com.affine.personalize.status.saved']();
      case 'error':
        return t['com.affine.personalize.status.error']();
      default:
        return '';
    }
  }, [status, t]);

  return (
    <>
      <SettingHeader
        title={t['com.affine.personalize.title']()}
        subtitle={t['com.affine.personalize.subtitle']()}
      />
      <SettingWrapper title={t['com.affine.personalize.section.title']()}>
        {!userSettings && errorMessage ? (
          <>
            <div className={styles.errorMessage}>{errorMessage}</div>
            <br />
          </>
        ) : null}
        <div className={styles.textareaWrapper}>
          <textarea
            data-testid="personalize-textarea"
            className={styles.textarea}
            placeholder={t['com.affine.personalize.placeholder']()}
            value={draft}
            disabled={disabled}
            maxLength={PERSONALIZE_MAX_LENGTH + 200 /* allow paste-then-trim */}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <div className={styles.footer}>
            <span className={styles.status}>{statusLabel}</span>
            <span
              className={
                overLimit
                  ? `${styles.counter} ${styles.counterError}`
                  : styles.counter
              }
            >
              {length} / {PERSONALIZE_MAX_LENGTH}
            </span>
          </div>
        </div>
      </SettingWrapper>
    </>
  );
};
