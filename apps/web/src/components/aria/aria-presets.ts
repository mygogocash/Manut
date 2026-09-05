export interface AriaPreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
  /**
   * Optional permission gates. When set, the chip only shows if the
   * caller holds at least one of the listed permission codes. Empty /
   * absent = visible to everyone with an ARIA seat.
   */
  requiresAny?: readonly string[];
}

export const ARIA_PRESETS: readonly AriaPreset[] = [
  {
    id: "financials",
    label: "Analyze financials",
    description: "Revenue quality, margins, risks, fundraise readiness",
    prompt:
      "Analyze our workspace financials based on the data you have: revenue quality, margins, key risks, and what we should prepare before talking to investors. Use numbers from context; if something is missing, say what to add.",
  },
  {
    id: "investor-update",
    label: "Draft investor update",
    description: "Concise update email in founder voice",
    prompt:
      "Draft a concise investor update email for this month. Include commercial progress, financial highlights, bridge round status if relevant, and key milestones. Founder voice, ready to send with minimal edits. Use markdown.",
  },
  {
    id: "anomalies",
    label: "Flag anomalies",
    description: "Risks across expenses, visas, partners, payroll",
    prompt:
      "Scan the workspace context for anomalies and risks: expenses, visa timelines, partner pipeline gaps, payroll or compliance pressure points. List the top issues with severity and recommended next actions.",
  },
  {
    id: "series-b",
    label: "Series B prep",
    description: "Narrative, comparables, metrics to sharpen",
    prompt:
      "Help us prepare for a Series B: narrative, positioning vs comparables, metrics investors will expect, and gaps in our current data. Be direct and actionable.",
  },
  {
    id: "crypto-memo",
    label: "BNRY accounting memo",
    description: "One-page crypto/token policy memo for auditors",
    prompt:
      "Draft a one-page crypto/token revenue and treasury accounting policy memo suitable for an external auditor. Clear definitions, recognition principles, controls, and open questions. Markdown headings.",
  },
  {
    id: "partners",
    label: "Partner pipeline",
    description: "90-day triage and CEO actions",
    prompt:
      "Review our partner pipeline using the context: 90-day triage (retain, grow, pause), top 5 CEO actions, and risks by partner segment.",
  },
  {
    id: "bridge",
    label: "Bridge round status",
    description: "Position, commitments, timeline risk",
    prompt:
      "Summarize bridge round status from investor and financial context: current position, commitments, timeline risks, and a crisp list of actions for this week.",
  },
  {
    id: "payroll-compliance",
    label: "Payroll & compliance",
    description: "Visas, filings, payroll anomalies",
    prompt:
      "Run a payroll and compliance check using the context: visa expiries, statutory or filing deadlines we should watch, and any payroll-related anomalies or follow-ups.",
  },
  // Role-tagged starters (ARIA improvement #6, 2026-05-25) — surface
  // to BD / HR / IT seats so the empty-state grid feels relevant for
  // every persona, not only executive.
  {
    id: "bd-pipeline",
    label: "My pipeline",
    description: "Open opportunities grouped by stage",
    prompt:
      "Summarise my Sales CRM pipeline grouped by stage with weighted value and the top 3 deals at risk.",
    requiresAny: ["crm:read"],
  },
  {
    id: "bd-account-status",
    label: "Account status check",
    description: "Recent activity + open opportunities for an account",
    prompt:
      "Give me the latest status on a specific Sales CRM account: recent activities, open opportunities, and any blocker I should know.",
    requiresAny: ["crm:read"],
  },
  {
    id: "hr-pending-approvals",
    label: "Pending approvals",
    description: "Items waiting on me across modules",
    prompt:
      "List the items currently waiting on me to approve across leave, expense, travel, and helpdesk modules.",
  },
  {
    id: "hr-visa-watch",
    label: "Visa expirations",
    description: "Who needs renewal in the next 90 days",
    prompt:
      "List employees whose visa or work permit expires in the next 90 days with the entity and remaining days.",
    requiresAny: ["visa:read"],
  },
  {
    id: "calendar-week",
    label: "This week's calendar",
    description: "Meetings + free blocks",
    prompt:
      "What's on my Google Calendar for the next 7 days? Group by day, flag the busiest day, and call out longer free blocks.",
    requiresAny: ["integrations:use"],
  },
] as const;
