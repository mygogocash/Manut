export type AuditActionTone = "green" | "amber" | "red" | "blue" | "grey";

/** Maps audit action strings to shared Badge / accent colors. */
export function auditActionVariant(action: string): AuditActionTone {
  const a = action.toLowerCase();
  if (["create", "login", "approve"].includes(a)) return "green";
  if (["update", "logout"].includes(a)) return "amber";
  if (["delete", "reject"].includes(a)) return "red";
  if (["export", "read", "view", "download"].includes(a)) return "blue";
  return "grey";
}
