import { IconButton, Skeleton } from '@affine/component';
import { useCatchEventCallback } from '@affine/core/components/hooks/use-catch-event-hook';
import { PagePreview } from '@affine/core/components/page-list/page-content-preview';
import { IsFavoriteIcon } from '@affine/core/components/pure/icons';
import { DocDisplayMetaService } from '@affine/core/modules/doc-display-meta';
import { CompatibleFavoriteItemsAdapter } from '@affine/core/modules/favorite';
import {
  WorkbenchLink,
  type WorkbenchLinkProps,
} from '@affine/core/modules/workbench';
import { FADE_UP_VARIANTS, SPRING_GENTLE } from '@affine/core/utils/motion';
import type { DocMeta } from '@blocksuite/affine/store';
import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { calcRowsById } from './calc-rows';
import * as styles from './styles.css';
import { DocCardTags } from './tag';

export { calcRowsById };

export interface DocCardProps extends Omit<WorkbenchLinkProps, 'to'> {
  meta: {
    id: DocMeta['id'];
    title?: ReactNode;
  } & { [key: string]: any };
  showTags?: boolean;

  /**
   * When enabled, preview's height will be calculated based on `meta.id`
   */
  autoHeightById?: boolean;
}

// Manut M2 E2.7 — hover preview delay. Match the 200ms requested in the
// implementation plan; long enough that grazing-cursor traversal across a
// grid doesn't strobe overlays, short enough that an intentional hover
// surfaces context without feeling sticky.
const HOVER_PREVIEW_DELAY_MS = 200;

export const DocCard = forwardRef<HTMLAnchorElement, DocCardProps>(
  function DocCard(
    { showTags = true, meta, className, autoHeightById, ...attrs },
    outerRef
  ) {
    const containerRef = useRef<HTMLAnchorElement | null>(null);
    const favAdapter = useService(CompatibleFavoriteItemsAdapter);
    const docDisplayService = useService(DocDisplayMetaService);
    const title = useLiveData(docDisplayService.title$(meta.id));
    const favorited = useLiveData(favAdapter.isFavorite$(meta.id, 'doc'));
    // Manut M2 E2.7 — hover preview overlay state. Gated on a 200ms delay
    // so quickly traversing a grid never opens overlays. Reduced-motion
    // users see no overlay at all (the preview is decorative; the card
    // body already shows the same snippet, so we don't lose information).
    const prefersReducedMotion = useReducedMotion();
    // Only wire the hover-preview machinery on devices that actually have a
    // hover-capable pointer. On touch (`hover: none`) the preview never fires
    // anyway, so reading matchMedia once at mount lets us short-circuit the
    // timers entirely instead of shipping dead listeners.
    const [hoverCapable] = useState(
      () =>
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover: hover)').matches
    );
    const [showHoverPreview, setShowHoverPreview] = useState(false);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearHoverTimer = useCallback(() => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    }, []);

    const handleHoverStart = useCallback(() => {
      if (prefersReducedMotion || !hoverCapable) return;
      clearHoverTimer();
      hoverTimerRef.current = setTimeout(() => {
        setShowHoverPreview(true);
      }, HOVER_PREVIEW_DELAY_MS);
    }, [clearHoverTimer, hoverCapable, prefersReducedMotion]);

    const handleHoverEnd = useCallback(() => {
      clearHoverTimer();
      setShowHoverPreview(false);
    }, [clearHoverTimer]);

    // Clear any pending timer on unmount; without this, a card removed
    // from the DOM during the 200ms window would call setState on an
    // unmounted component (React 19 quiet-warns, but worth being clean).
    useEffect(() => clearHoverTimer, [clearHoverTimer]);

    const toggleFavorite = useCatchEventCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        favAdapter.toggle(meta.id, 'doc');
      },
      [favAdapter, meta.id]
    );

    const contentStyle = useMemo(() => {
      if (!autoHeightById) return { flex: 1 };
      const rows = calcRowsById(meta.id);
      return { height: `${rows * 18}px` };
    }, [autoHeightById, meta.id]);

    return (
      <WorkbenchLink
        to={`/${meta.id}`}
        ref={ref => {
          containerRef.current = ref;
          if (typeof outerRef === 'function') {
            outerRef(ref);
          } else if (outerRef) {
            outerRef.current = ref;
          }
        }}
        className={clsx(styles.card, className)}
        data-testid="doc-card"
        data-doc-id={meta.id}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
        onFocus={handleHoverStart}
        onBlur={handleHoverEnd}
        {...attrs}
      >
        <header className={styles.head} data-testid="doc-card-header">
          <h3 className={styles.title}>{title}</h3>
          <IconButton
            aria-label="favorite"
            icon={
              <IsFavoriteIcon onClick={toggleFavorite} favorite={favorited} />
            }
          />
        </header>
        <main className={styles.content} style={contentStyle}>
          <PagePreview
            fallback={
              <>
                <Skeleton />
                <Skeleton width={'60%'} />
              </>
            }
            pageId={meta.id}
            emptyFallback={<div className={styles.contentEmpty}>Empty</div>}
          />
        </main>
        {showTags ? <DocCardTags docId={meta.id} rows={2} /> : null}
        <AnimatePresence>
          {showHoverPreview && !prefersReducedMotion ? (
            <motion.div
              key="hover-preview"
              className={styles.hoverPreview}
              data-testid="doc-card-hover-preview"
              variants={FADE_UP_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={SPRING_GENTLE}
            >
              <div className={styles.hoverPreviewTitle}>{title}</div>
              <div className={styles.hoverPreviewSnippet}>
                <PagePreview
                  pageId={meta.id}
                  emptyFallback={
                    <span className={styles.contentEmpty}>Empty</span>
                  }
                  fallback={
                    <>
                      <Skeleton />
                      <Skeleton width={'60%'} />
                    </>
                  }
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </WorkbenchLink>
    );
  }
);
