// Helpdesk SLA policy — the response + resolution clocks (in HOURS) that
// each ticket priority is measured against. These thresholds define what
// the IT CRM dashboard counts as "within SLA" vs "breached", so they are a
// genuine IT-operations decision, not a constant of convenience.
//
//   response   = createdAt → firstResponseAt   (IT first engages the ticket)
//   resolution = createdAt → resolvedAt        (ticket reaches resolved/closed)
//
// Defaults below follow a conventional 4-tier ITSM ladder. Tune them to the
// service levels your team actually commits to. The shape is the contract:
// these can later be promoted to editable HelpdeskSettings columns without
// touching any dashboard maths.

export type SlaPriority = "urgent" | "high" | "medium" | "low";

export type SlaTarget = {
  /** Hours allowed from creation to first IT engagement. */
  response: number;
  /** Hours allowed from creation to resolution. */
  resolution: number;
};

export const HELPDESK_SLA: Record<SlaPriority, SlaTarget> = {
  urgent: { response: 1, resolution: 4 },
  high: { response: 4, resolution: 24 },
  medium: { response: 8, resolution: 72 },
  low: { response: 24, resolution: 168 },
};

// Falls back to the `medium` tier for any unrecognised priority string so a
// future priority value never silently drops out of the attainment maths.
export function slaTargetFor(priority: string): SlaTarget {
  return HELPDESK_SLA[priority as SlaPriority] ?? HELPDESK_SLA.medium;
}
