import { useFirstRunSeed } from '../use-first-run-seed';
import { TourOverlay } from './tour-overlay';

/**
 * Mount once inside the workspace layout. Seeds the welcome doc when the
 * workspace is empty, and renders the tour overlay (which gates itself on
 * localStorage so it shows at most once per browser).
 */
export function FirstRunExperience() {
  useFirstRunSeed();
  return <TourOverlay />;
}
