/**
 * PostHog connection scaffold — API-key + host (NOT OAuth).
 *
 * Storage shape: workspace stores two fields:
 *   - `apiKey` — PostHog personal API key, encrypted at rest in the
 *     `accessToken` column (reuses the OAuth encryption helper).
 *   - `host` — PostHog host base URL (e.g. `https://us.posthog.com` or
 *     `https://eu.posthog.com` or a self-hosted URL). Default
 *     `https://app.posthog.com`. Stored as plaintext metadata since
 *     it's the equivalent of a server hostname — not a secret.
 *
 * Test flow: a "Test connection" mutation hits
 * `{host}/api/projects/?personal_api_key={key}` (or with Bearer auth)
 * and asserts a 200 response.
 */

export type PostHogScope = 'posthog';

export const POSTHOG_PROVIDER_NAME = 'posthog';

export const POSTHOG_DEFAULT_HOST = 'https://app.posthog.com';

export interface PostHogConnectionStatus {
  connected: boolean;
  /** PostHog host (e.g. `https://us.posthog.com`). Returned for UI. */
  host?: string;
  /**
   * Project count from the most recent successful test. Optional —
   * absent on freshly-saved connections that haven't been tested.
   */
  projectCount?: number;
}

export interface PostHogConnectionInput {
  apiKey: string;
  /** Defaults to `https://app.posthog.com` if omitted. */
  host?: string;
}

export interface PostHogConnectionTestResult {
  ok: boolean;
  error?: string;
  host?: string;
  projectCount?: number;
}

/**
 * Shape returned by https://{host}/api/projects/. We persist only the
 * project count; full project metadata is fetched on demand by the AI
 * tools follow-up.
 */
export interface PostHogProjectsResponse {
  count: number;
  results: Array<{
    id: number;
    name: string;
  }>;
}
