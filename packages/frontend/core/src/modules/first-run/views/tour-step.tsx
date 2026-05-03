import {
  arrow as floatingArrow,
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';
import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { TourStep as TourStepConfig } from '../tour-config';
import * as styles from './tour-step.css';

interface TourStepProps {
  step: TourStepConfig;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findAnchor(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const found = document.querySelector(selector);
    if (found instanceof HTMLElement) return found;
  }
  return null;
}

export function TourStep({
  step,
  index,
  total,
  onNext,
  onSkip,
}: TourStepProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({
    opacity: 0,
  });
  const [arrowStyle, setArrowStyle] = useState<CSSProperties>({});
  const [highlightRect, setHighlightRect] = useState<AnchorRect | null>(null);

  // Resolve anchor element imperatively, polling briefly in case it mounts late
  // (sidebar buttons render after workspace init).
  const [anchor, setAnchor] = useState<HTMLElement | null>(() =>
    findAnchor(step.anchorSelectors)
  );

  useEffect(() => {
    if (anchor) return;
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      const found = findAnchor(step.anchorSelectors);
      if (found) {
        setAnchor(found);
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        // ~4s total budget at 100ms intervals
        window.setTimeout(tick, 100);
      }
    };
    window.setTimeout(tick, 100);
    return () => {
      cancelled = true;
    };
  }, [anchor, step.anchorSelectors]);

  // Reset anchor lookup when the step changes
  useLayoutEffect(() => {
    setAnchor(findAnchor(step.anchorSelectors));
    setTooltipStyle({ opacity: 0 });
  }, [step.anchorSelectors]);

  // Position tooltip + highlight ring against the anchor
  useEffect(() => {
    if (!anchor || !tooltipRef.current) return;
    const tooltipEl = tooltipRef.current;
    const arrowEl = arrowRef.current;

    const cleanup = autoUpdate(anchor, tooltipEl, () => {
      const middleware = [offset(12), flip(), shift({ padding: 12 })];
      if (arrowEl) middleware.push(floatingArrow({ element: arrowEl }));

      computePosition(anchor, tooltipEl, {
        placement: step.placement ?? 'right',
        middleware,
      })
        .then(({ x, y, placement, middlewareData }) => {
          setTooltipStyle({
            top: 0,
            left: 0,
            transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`,
            opacity: 1,
          });
          if (arrowEl && middlewareData.arrow) {
            const { x: ax, y: ay } = middlewareData.arrow;
            const side = placement.split('-')[0];
            const oppositeSide: Record<string, string> = {
              top: 'bottom',
              right: 'left',
              bottom: 'top',
              left: 'right',
            };
            const staticSide = oppositeSide[side] ?? 'bottom';
            setArrowStyle({
              left: ax != null ? `${ax}px` : '',
              top: ay != null ? `${ay}px` : '',
              [staticSide]: '-5px',
            });
          }

          const rect = anchor.getBoundingClientRect();
          setHighlightRect({
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          });
        })
        .catch(() => {
          // anchor was removed mid-computation; ignore
        });
    });

    return cleanup;
  }, [anchor, step.placement]);

  // If the anchor never resolves, render the tooltip centred so the user can
  // still dismiss the tour.
  const fallbackCentered = !anchor;

  return (
    <>
      {highlightRect && !fallbackCentered ? (
        <div
          className={styles.highlightRing}
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      ) : null}
      <div
        ref={tooltipRef}
        className={styles.tooltip}
        role="dialog"
        aria-label={step.title}
        style={
          fallbackCentered
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 1,
              }
            : tooltipStyle
        }
        data-testid={`first-run-tour-step-${step.id}`}
      >
        {!fallbackCentered ? (
          <div ref={arrowRef} className={styles.arrow} style={arrowStyle} />
        ) : null}
        <div className={styles.title}>{step.title}</div>
        <div className={styles.body}>{step.body}</div>
        <div className={styles.footer}>
          <span className={styles.progress}>
            Step {index + 1} of {total}
          </span>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.button}
              onClick={onSkip}
              data-testid="first-run-tour-skip"
            >
              Skip
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onNext}
              data-testid="first-run-tour-next"
            >
              {index + 1 === total ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
