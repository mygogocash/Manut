import type { RouteObject } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { isWorkbenchDocRoutePath } from '../route-classification';

const routesWithDynamicBeforeStatic = [
  { path: '/all' },
  { path: '/:pageId' },
  { path: '/:pageId/attachments/:attachmentId' },
  { path: '/journals' },
  { path: '/analytics' },
  { path: '/analytics/:platform' },
  { path: '*' },
] satisfies RouteObject[];

describe('isWorkbenchDocRoutePath', () => {
  test('keeps reserved workspace routes out of the doc route fallback', () => {
    expect(
      isWorkbenchDocRoutePath(routesWithDynamicBeforeStatic, '/journals')
    ).toBe(false);
    expect(
      isWorkbenchDocRoutePath(routesWithDynamicBeforeStatic, '/analytics')
    ).toBe(false);
    expect(
      isWorkbenchDocRoutePath(
        routesWithDynamicBeforeStatic,
        '/analytics/facebook'
      )
    ).toBe(false);
  });

  test('still classifies single-segment non-reserved paths as doc routes', () => {
    expect(
      isWorkbenchDocRoutePath(routesWithDynamicBeforeStatic, '/doc-123')
    ).toBe(true);
  });

  test('does not classify nested doc attachment paths as the single-doc route', () => {
    expect(
      isWorkbenchDocRoutePath(
        routesWithDynamicBeforeStatic,
        '/doc-123/attachments/file-1'
      )
    ).toBe(false);
  });
});
