/**
 * OKF v0.2 leaves `type` free-form ("Type values are not registered
 * centrally"). We pin a closed vocabulary for THIS bundle so a typo becomes
 * a test failure instead of a silently-unroutable concept.
 */
export const ALLOWED_TYPES = [
  "Pitfall",
  "Playbook",
  "Reference",
  "Runbook",
  "Decision",
  "Module",
  "Prisma Model",
  "API Endpoint",
  "Permission",
] as const;

export const ALLOWED_STATUSES = ["draft", "stable", "deprecated"] as const;

export const OKF_VERSION = "0.2";
