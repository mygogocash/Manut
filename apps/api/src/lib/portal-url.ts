const PRODUCTION_PORTAL_URL = "https://intranet.thebinaryholdings.com";

// Resolves the public portal URL used in outbound emails and OAuth
// redirects. Order: `PORTAL_URL` (explicit override), `NEXT_PUBLIC_APP_URL`
// (legacy — set as a GitHub secret), then the production hostname.
export function getPortalUrl(): string {
  return (
    process.env.PORTAL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    PRODUCTION_PORTAL_URL
  );
}

export const PORTAL_URL = getPortalUrl();
