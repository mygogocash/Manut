/**
 * GoGoCash internal connection scaffold — API-key auth, no OAuth.
 *
 * Storage shape: a single `apiKey` per workspace, encrypted at rest
 * using the same AESCBC helper used by OAuth access tokens
 * (`integrationConnection.accessToken`).
 *
 * Unlike the MongoDB / PostHog connectors, this is a Manut-internal
 * platform — there's no third-party API to probe before persistence
 * because the analytics consumer is in-house and the contract is
 * controlled by us. The resolver just stores the key; live ingest
 * lands in a separate follow-up that consumes
 * `GoGoCashConnectionService.getValidApiKey`.
 *
 * Security posture:
 *  - The API key is the credential. Encrypt at rest, never log.
 *  - The frontend surfaces only `connected: bool` — never the key.
 */

export type GoGoCashScope = 'gogocash';

export const GOGOCASH_PROVIDER_NAME = 'gogocash';

export interface GoGoCashConnectionStatus {
  connected: boolean;
  /**
   * Optional label — typically the trimmed prefix of the API key
   * (first 6 chars + ellipsis) so the user can confirm which key is
   * stored without leaking the full value. The service NEVER returns
   * the full key over GraphQL.
   */
  label?: string;
}

export interface GoGoCashConnectionInput {
  apiKey: string;
  /**
   * Optional human-readable label (e.g. "Production key", "Sandbox").
   * Stored as metadata, separate from the masked key prefix.
   */
  label?: string;
}
