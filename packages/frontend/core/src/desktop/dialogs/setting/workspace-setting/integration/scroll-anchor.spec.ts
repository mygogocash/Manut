import { describe, expect, test } from 'vitest';

import {
  CALENDAR_INTEGRATION_SCROLL_ANCHOR,
  GITHUB_INTEGRATION_SCROLL_ANCHOR,
} from '../../navigation-constants';
import { getIntegrationIdForScrollAnchor } from './scroll-anchor';

describe('integration scroll anchors', () => {
  test('getIntegrationIdForScrollAnchor__given_known_anchor__then_returns_integration_id', () => {
    expect(
      getIntegrationIdForScrollAnchor(CALENDAR_INTEGRATION_SCROLL_ANCHOR)
    ).toBe('calendar');
    expect(
      getIntegrationIdForScrollAnchor(GITHUB_INTEGRATION_SCROLL_ANCHOR)
    ).toBe('github');
  });

  test('getIntegrationIdForScrollAnchor__given_missing_or_unknown_anchor__then_returns_null', () => {
    expect(getIntegrationIdForScrollAnchor()).toBeNull();
    expect(getIntegrationIdForScrollAnchor('unknown')).toBeNull();
  });
});
