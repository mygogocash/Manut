const PUBLIC_SIGNING_PATH = /^\/sign\/[^/]+(?:\/|$)/i;

export function isPublicSigningPath(pathname: string): boolean {
  return PUBLIC_SIGNING_PATH.test(pathname);
}
