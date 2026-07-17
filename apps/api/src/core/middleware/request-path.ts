const PUBLIC_LEGAL_SIGNING_TOKEN =
  /^(\/api\/legal-public\/sign\/)[^/]+(?=\/|$)/i;

export function redactSensitiveRequestPath(path: string) {
  return path.replace(PUBLIC_LEGAL_SIGNING_TOKEN, "$1[REDACTED]");
}
