/**
 * First-run experience for new workspaces:
 *
 * - {@link useFirstRunSeed} seeds an empty workspace with a welcome doc.
 * - {@link TourOverlay} shows a 4-step tooltip tour, fired once per browser
 *   (gated on `affine.first-run-tour.completed.v1` in localStorage).
 *
 * Mount both inside the workspace layout so they run after the workspace has
 * loaded and the sidebar / AI island are in the DOM.
 */
export {
  FIRST_RUN_WELCOME_DOC_TITLE,
  seedWelcomeDoc,
  workspaceIsEmpty,
} from './seed-doc';
export type { TourStep as TourStepConfig } from './tour-config';
export {
  FIRST_RUN_TOUR_STEPS,
  FIRST_RUN_TOUR_STORAGE_KEY,
  isTourCompleted,
  markTourCompleted,
} from './tour-config';
export { useFirstRunSeed } from './use-first-run-seed';
export { FirstRunExperience } from './views/first-run-experience';
export { TourOverlay } from './views/tour-overlay';
export { TourStep } from './views/tour-step';
