/**
 * localStorage key used to record completion of the first-run tour.
 * Bumping the suffix (`v1` -> `v2`) re-runs the tour for everyone.
 */
export const FIRST_RUN_TOUR_STORAGE_KEY = 'affine.first-run-tour.completed.v1';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /**
   * CSS selectors tried in order; the first element found in the DOM is used
   * as the anchor for the tooltip. Allows fallbacks across desktop / browser
   * builds.
   */
  anchorSelectors: string[];
  /**
   * Preferred tooltip placement relative to the anchor. Falls back via
   * floating-ui's autoPlacement if the preferred placement does not fit.
   */
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

export const FIRST_RUN_TOUR_STEPS: TourStep[] = [
  {
    id: 'sidebar',
    title: 'Your workspace lives here',
    body: 'This is your workspace. Create docs, switch views, and invite teammates from the sidebar.',
    anchorSelectors: [
      '[data-testid="app-sidebar"]',
      '[data-testid="app-sidebar-wrapper"]',
    ],
    placement: 'right',
  },
  {
    id: 'ai-chat',
    title: 'Ask the AI anything',
    body: 'Press here for AI chat - ask anything about your docs, summarise them, or draft new content.',
    anchorSelectors: ['[data-testid="ai-island"]', '[data-testid="ai-chat"]'],
    placement: 'left',
  },
  {
    id: 'new-doc',
    title: 'Create a new doc',
    body: 'Quick-create a new doc. Tap to open a blank page, or hold for AI-assisted drafting.',
    anchorSelectors: [
      '[data-testid="sidebar-new-page-button"]',
      '[data-testid="sidebar-new-page-with-ask-button"]',
    ],
    placement: 'right',
  },
  {
    id: 'settings',
    title: 'Configure your workspace',
    body: 'Configure integrations, calendar, and AI from Settings.',
    anchorSelectors: [
      '[data-testid="slider-bar-workspace-setting-button"]',
      '[data-testid="settings-modal-trigger"]',
    ],
    placement: 'right',
  },
];

export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_TOUR_STORAGE_KEY) === 'true';
  } catch {
    // localStorage may be unavailable in private mode; treat as completed
    // so we don't keep trying to show a tour we cannot persist.
    return true;
  }
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(FIRST_RUN_TOUR_STORAGE_KEY, 'true');
  } catch {
    // ignore - see isTourCompleted above
  }
}
