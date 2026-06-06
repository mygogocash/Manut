import {
  CALENDAR_INTEGRATION_SCROLL_ANCHOR,
  GITHUB_INTEGRATION_SCROLL_ANCHOR,
} from '../../navigation-constants';

type AutoOpenIntegrationId = 'calendar' | 'github';

export function getIntegrationIdForScrollAnchor(
  scrollAnchor?: string
): AutoOpenIntegrationId | null {
  switch (scrollAnchor) {
    case CALENDAR_INTEGRATION_SCROLL_ANCHOR:
      return 'calendar';
    case GITHUB_INTEGRATION_SCROLL_ANCHOR:
      return 'github';
    default:
      return null;
  }
}
