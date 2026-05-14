import { expect, test } from 'vitest';

import { isAnalyticsFeatureUnavailableError } from '../services/connection.service';

test('returns true for the canonical UserFriendlyError shape', () => {
  expect(
    isAnalyticsFeatureUnavailableError({
      name: 'GRAPHQL_BAD_REQUEST',
      message:
        'GraphQL bad request, code: GRAPHQL_VALIDATION_FAILED, Cannot query field "connections" on type "Query". Did you mean "listConnections"?',
      data: { code: 'GRAPHQL_VALIDATION_FAILED' },
    })
  ).toBe(true);
});

test('returns true when only the message survived (fromAny fallback path)', () => {
  expect(
    isAnalyticsFeatureUnavailableError(
      new Error('Cannot query field "connections" on type "Query"')
    )
  ).toBe(true);
});

test('returns true for the schema-missing getOverview error (overview loader regression)', () => {
  // Regression coverage for the analytics overview "Could not load
  // analytics: Unhandled error raised. Please contact us for help." prod
  // bug — when the deployed backend's schema lacks `getOverview` (env-var
  // skew or stale image), the frontend fetcher throws a GRAPHQL_BAD_REQUEST
  // shaped error. The overview loader (in analytics.service.ts) classifies
  // it via this helper to flip `unavailable=true` rather than rendering
  // the generic error banner.
  expect(
    isAnalyticsFeatureUnavailableError({
      name: 'GRAPHQL_BAD_REQUEST',
      message:
        'GraphQL bad request, code: GRAPHQL_VALIDATION_FAILED, Cannot query field "getOverview" on type "Query".',
      data: { code: 'GRAPHQL_VALIDATION_FAILED' },
    })
  ).toBe(true);
});

test('returns true for a generic GRAPHQL_VALIDATION_FAILED message', () => {
  expect(
    isAnalyticsFeatureUnavailableError(
      new Error('GraphQL bad request, code: GRAPHQL_VALIDATION_FAILED')
    )
  ).toBe(true);
});

test('returns false for unrelated 401 auth error', () => {
  expect(
    isAnalyticsFeatureUnavailableError({
      name: 'AUTHENTICATION_REQUIRED',
      message: 'You must sign in first to access this resource.',
      data: undefined,
    })
  ).toBe(false);
});

test('returns false for a plain Error with unrelated message', () => {
  expect(isAnalyticsFeatureUnavailableError(new Error('Network error'))).toBe(
    false
  );
});

test('returns false for null / undefined / non-object inputs', () => {
  expect(isAnalyticsFeatureUnavailableError(null)).toBe(false);
  expect(isAnalyticsFeatureUnavailableError(undefined)).toBe(false);
  expect(isAnalyticsFeatureUnavailableError('schema-missing')).toBe(false);
  expect(isAnalyticsFeatureUnavailableError(42)).toBe(false);
});
