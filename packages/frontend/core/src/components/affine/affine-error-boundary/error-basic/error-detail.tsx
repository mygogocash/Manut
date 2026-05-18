import { Scrollable } from '@affine/component';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { Trans, useI18n } from '@affine/i18n';
import { ArrowDownSmallIcon } from '@blocksuite/icons/rc';
import type { FC, PropsWithChildren, ReactNode, SVGProps } from 'react';
import { useCallback, useState } from 'react';

import { ActionButton } from '../../empty/action-button';
import { ErrorIllustration404, ErrorIllustration500 } from '../error-assets';
import * as styles from './error-detail.css';

export enum ErrorStatus {
  NotFound = 404,
  Unexpected = 500,
}

export interface ErrorDetailProps extends PropsWithChildren {
  status?: ErrorStatus;
  title: string;
  description: ReactNode | Array<ReactNode>;
  buttonText?: string;
  onButtonClick?: () => void | Promise<void>;
  resetError?: () => void;
  error?: Error;
}

/**
 * Manut v1.13 — themeable inline-SVG illustrations replace the legacy
 * 404.{light,dark}.png + 500.{light,dark}.png assets. PNGs in
 * `../error-assets/{404,500}.{light,dark}.png` are unreferenced and
 * flagged for cleanup in a follow-up commit.
 */
const ILLUSTRATION_BY_STATUS: Record<
  ErrorStatus,
  FC<SVGProps<SVGSVGElement>>
> = {
  [ErrorStatus.NotFound]: ErrorIllustration404,
  [ErrorStatus.Unexpected]: ErrorIllustration500,
};

/**
 * TODO(@eyhn): Unify with NotFoundPage.
 */
export const ErrorDetail: FC<ErrorDetailProps> = props => {
  const {
    status = ErrorStatus.Unexpected,
    description,
    onButtonClick,
    resetError,
    error,
  } = props;
  const descriptions = Array.isArray(description) ? description : [description];
  const [isBtnLoading, setBtnLoading] = useState(false);
  const [showStack, setShowStack] = useState(false);
  const t = useI18n();

  const onToggleStack = useCallback(() => {
    setShowStack(!showStack);
  }, [showStack]);

  const onBtnClick = useAsyncCallback(async () => {
    try {
      setBtnLoading(true);
      await onButtonClick?.();
      resetError?.(); // Only reset when retry success.
    } finally {
      setBtnLoading(false);
    }
  }, [onButtonClick, resetError]);

  const desc = descriptions.map((item, i) => (
    <p key={`error-desc-${i}`} className={styles.text}>
      {item}
    </p>
  ));

  const Illustration = ILLUSTRATION_BY_STATUS[status] ?? ErrorIllustration500;
  const statusLabel = status === ErrorStatus.NotFound ? '404' : '500';

  return (
    <div className={styles.errorLayout}>
      <div className={styles.errorContainer} data-show-stack={showStack}>
        <Illustration className={styles.illustration} aria-hidden="true" />

        <div className={styles.label}>
          <div
            className={styles.statusBadge}
            aria-label={`Error ${statusLabel}`}
          >
            Error {statusLabel}
          </div>
          <h1 className={styles.heading}>{props.title}</h1>
          <div className={styles.text}>{desc}</div>
        </div>
        <Scrollable.Root
          className={styles.scrollArea}
          data-show-stack={showStack}
        >
          <Scrollable.Viewport>
            {error?.stack || 'No detailed error stack is provided.'}
          </Scrollable.Viewport>
          <Scrollable.Scrollbar />
        </Scrollable.Root>

        <div className={styles.actionContainer}>
          {error?.stack ? (
            <ActionButton
              onClick={onToggleStack}
              className={styles.actionButton}
            >
              <div className={styles.actionContent}>
                <span>{t['com.affine.error.hide-error']()}</span>
                <ArrowDownSmallIcon
                  data-show-stack={showStack}
                  className={styles.arrowIcon}
                />
              </div>
            </ActionButton>
          ) : null}
          <ActionButton
            onClick={onBtnClick}
            className={styles.actionButton}
            loading={isBtnLoading}
            variant="primary"
          >
            {props.buttonText ?? t['com.affine.error.reload']()}
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

export function ContactUS() {
  return (
    <Trans
      i18nKey="com.affine.error.contact-us"
      components={{
        1: (
          <a
            style={{ color: 'var(--affine-primary-color)' }}
            href="https://affine.pro/redirect/discord"
            target="__blank"
          />
        ),
      }}
    />
  );
}
