import { useCallback, useEffect, useState } from 'react';

import {
  FIRST_RUN_TOUR_STEPS,
  isTourCompleted,
  markTourCompleted,
} from '../tour-config';
import { TourStep } from './tour-step';
import * as styles from './tour-step.css';

interface TourOverlayProps {
  /**
   * Force-show the overlay even if the user has completed it before.
   * Useful for "replay tour" buttons in settings.
   */
  forceShow?: boolean;
  /**
   * Optional small delay before showing the first step, so the underlying
   * UI has a chance to settle (sidebar, AI island animations, etc.).
   */
  startDelayMs?: number;
}

export function TourOverlay({
  forceShow = false,
  startDelayMs = 600,
}: TourOverlayProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!forceShow && isTourCompleted()) return;
    const timer = window.setTimeout(() => setShouldShow(true), startDelayMs);
    return () => window.clearTimeout(timer);
  }, [forceShow, startDelayMs]);

  const finish = useCallback(() => {
    markTourCompleted();
    setShouldShow(false);
  }, []);

  const handleNext = useCallback(() => {
    setStepIndex(current => {
      if (current + 1 >= FIRST_RUN_TOUR_STEPS.length) {
        finish();
        return current;
      }
      return current + 1;
    });
  }, [finish]);

  if (!shouldShow) return null;

  const step = FIRST_RUN_TOUR_STEPS[stepIndex];
  if (!step) return null;

  return (
    <div className={styles.backdrop} data-testid="first-run-tour-overlay">
      <TourStep
        step={step}
        index={stepIndex}
        total={FIRST_RUN_TOUR_STEPS.length}
        onNext={handleNext}
        onSkip={finish}
      />
    </div>
  );
}
