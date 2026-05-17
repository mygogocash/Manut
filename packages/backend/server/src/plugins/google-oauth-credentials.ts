import type { OAuthProviderConfig } from './oauth/config';

/**
 * Shared Google OAuth client resolution for sign-in (`oauth.providers.google`),
 * workspace integrations (`GOOGLE_OAUTH_*`), and calendar (`calendar.google`).
 */
export type ResolvedGoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

export function resolveGoogleOAuthCredentials(
  configured?: Pick<OAuthProviderConfig, 'clientId' | 'clientSecret'> | null
): ResolvedGoogleOAuthCredentials | null {
  if (configured?.clientId && configured?.clientSecret) {
    return {
      clientId: configured.clientId,
      clientSecret: configured.clientSecret,
    };
  }

  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET ??
    '';

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}
