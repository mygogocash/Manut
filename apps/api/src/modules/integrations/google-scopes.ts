/** OAuth scope helpers for per-user Google Workspace connections. */

const GMAIL_SEND_SCOPE_MARKERS = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://mail.google.com/",
] as const;

export function hasGmailSendScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return GMAIL_SEND_SCOPE_MARKERS.some((marker) => scope.includes(marker));
}

export function hasGmailReadScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return (
    scope.includes("https://www.googleapis.com/auth/gmail.readonly") ||
    hasGmailSendScope(scope)
  );
}

export function isGoogleInsufficientScopeError(
  status: number,
  body: string,
): boolean {
  if (status !== 403) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes("insufficient") ||
    lower.includes("insufficientpermissions") ||
    lower.includes("access_token_scope_insufficient")
  );
}
