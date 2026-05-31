import { DebugLogger } from '@affine/debug';
import { describe, expect, test, vi } from 'vitest';

import { applyOverviewLoadError } from '../services/analytics.service';

/**
 * Regression coverage for the analytics overview "Could not load analytics:
 * Unhandled error raised. Please contact us for help." production bug.
 *
 * The loader's catch-path is responsible for classifying the error into one
 * of two paths:
 *
 *   1. Backend GraphQL schema doesn't expose `getOverview` (e.g. stale image
 *      on the deployed server, or env-var skew that disabled the module):
 *      surface a typed `unavailable` flag so the view can render an
 *      actionable notice instead of the catch-all error banner.
 *   2. Real failure (Prisma table-missing, 5xx, permission denied, network
 *      timeout): surface the error message verbatim in `error$` and let
 *      it propagate to observability.
 *
 * Before this patch shipped, every catch fell into path 2, so a schema-
 * missing deploy surfaced "Unhandled error raised. Please contact us for
 * help." — the `UserFriendlyError.fromAny()` catch-all message — on the
 * panel. That confused operators because the underlying cause was a
 * deployment skew, not a real crash.
 *
 * This spec verifies the classification + setter wiring. The classifier
 * itself is covered separately by `is-feature-unavailable-error.spec.ts`.
 */

function makeMock() {
  return {
    setOverview: vi.fn(),
    setError: vi.fn(),
    setUnavailable: vi.fn(),
  };
}

// Spy on the DebugLogger the helper now uses for the diagnostic on the
// unavailable path. (The helper moved off `console.warn` to the shared
// DebugLogger — see the no-console cleanup.)
const errorSpy = vi
  .spyOn(DebugLogger.prototype, 'error')
  .mockImplementation(() => undefined);

describe('applyOverviewLoadError', () => {
  test('schema-missing GRAPHQL_BAD_REQUEST -> unavailable=true, error=null, overview=null', () => {
    const data = makeMock();
    const err = {
      name: 'GRAPHQL_BAD_REQUEST',
      message:
        'GraphQL bad request, code: GRAPHQL_VALIDATION_FAILED, Cannot query field "getOverview" on type "Query".',
      data: { code: 'GRAPHQL_VALIDATION_FAILED' },
    };

    applyOverviewLoadError(data, err);

    expect(data.setOverview).toHaveBeenCalledWith(null);
    expect(data.setUnavailable).toHaveBeenCalledWith(true);
    expect(data.setError).toHaveBeenCalledWith(null);
    expect(errorSpy).toHaveBeenCalled();
  });

  test('plain Error with "Cannot query field" message also flips unavailable', () => {
    // Fallback for the case where UserFriendlyError.fromAny() lost the
    // structured fields and only the message survived (production
    // observed this when error responses came back without proper
    // extensions).
    const data = makeMock();
    const err = new Error('Cannot query field "getOverview" on type "Query".');

    applyOverviewLoadError(data, err);

    expect(data.setUnavailable).toHaveBeenCalledWith(true);
    expect(data.setError).toHaveBeenCalledWith(null);
  });

  test('Prisma table-missing -> error="...does not exist...", unavailable=false', () => {
    // This is the deployment-level failure mode: data migration
    // `1746345600000-analytics-platform` did not run, so Prisma raises
    // P2021 when the resolver queries `social_metrics`. The error MUST
    // NOT be classified as unavailable — operators need to see the
    // message so they investigate the missing migration rather than
    // assuming the feature is "just disabled".
    const data = makeMock();
    const err = Object.assign(new Error(), {
      name: 'INTERNAL_SERVER_ERROR',
      message:
        'The table "public.social_metrics" does not exist in the current database.',
    });

    applyOverviewLoadError(data, err);

    expect(data.setUnavailable).not.toHaveBeenCalledWith(true);
    expect(data.setError).toHaveBeenCalledWith(
      expect.stringContaining('social_metrics')
    );
  });

  test('AUTHENTICATION_REQUIRED -> error=msg, unavailable=false', () => {
    // 401 should NOT be classified as unavailable — the user just isn't
    // signed in (or their session expired). The standard error banner
    // is the right UX; the unavailable copy ("ask your admin to enable
    // the module") would be misleading.
    const data = makeMock();
    const err = Object.assign(new Error(), {
      name: 'AUTHENTICATION_REQUIRED',
      message: 'You must sign in first to access this resource.',
    });

    applyOverviewLoadError(data, err);

    expect(data.setUnavailable).not.toHaveBeenCalledWith(true);
    expect(data.setError).toHaveBeenCalledWith(
      'You must sign in first to access this resource.'
    );
  });

  test('non-Error throwables surface as "Unknown error"', () => {
    // Defensive: gqlFetcherFactory throws GraphQLError-shaped objects but
    // upstream rxjs operators can throw arbitrary values. The loader's
    // error contract says `error$` is always a string, so non-Error
    // throwables MUST be coerced rather than passed through verbatim.
    const data = makeMock();
    applyOverviewLoadError(data, 42);
    expect(data.setError).toHaveBeenCalledWith('Unknown error');

    const data2 = makeMock();
    applyOverviewLoadError(data2, null);
    expect(data2.setError).toHaveBeenCalledWith('Unknown error');

    const data3 = makeMock();
    applyOverviewLoadError(data3, undefined);
    expect(data3.setError).toHaveBeenCalledWith('Unknown error');
  });
});
