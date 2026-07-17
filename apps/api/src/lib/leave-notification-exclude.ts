// Addresses that must never receive the HR-desk leave fan-out, even when an
// admin has them in the `leave.notification_recipients` list. Ops-controlled
// via the LEAVE_NOTIFICATION_EXCLUDE env var (comma / semicolon / newline
// separated emails).
//
// Built so the CEO / exec line stays off the all-staff leave email blast
// while the admin-managed recipient list itself is left untouched: the email
// is filtered at SEND time, so an admin re-adding it in the UI is harmless and
// approval routing (which never reads this list) is unaffected.
export function getExcludedLeaveRecipients(): Set<string> {
  const raw = process.env.LEAVE_NOTIFICATION_EXCLUDE ?? "";
  return new Set(
    raw
      .split(/[,;\n]/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

// Drop excluded addresses (case-insensitive, whitespace-tolerant) from a
// recipient list. Returns the input untouched when nothing is excluded.
export function filterExcludedLeaveRecipients(emails: string[]): string[] {
  const excluded = getExcludedLeaveRecipients();
  if (excluded.size === 0) return emails;
  return emails.filter((email) => !excluded.has(email.trim().toLowerCase()));
}
