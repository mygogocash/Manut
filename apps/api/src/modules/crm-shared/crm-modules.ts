// Single source of truth for the per-CRM notification + reminder wiring.
//
// One `crm_notifications` table, one deadline-reminder cron, and one bell read
// serve every CRM; each CRM is one descriptor here. Adding a CRM = adding a
// row below + calling the shared notifier from its task-write path.
//
// `module` is the discriminator stored on CrmNotification and used to key the
// admin-editable recipient list (SystemSetting `<recipientKey>`). `listSlug`
// is the `?from=` value the board deep-link carries so "Back" returns to the
// right CRM list.

export type CrmModule =
  | "it"
  | "general"
  | "product"
  | "legal"
  | "accounting"
  | "hr"
  | "qa"
  | "marketing";

export interface CrmModuleConfig {
  /** Stored on CrmNotification.module + used for logging. */
  module: CrmModule;
  /** Human label shown in emails / bell group. */
  label: string;
  /** `?from=` slug on the board deep-link (drives the Back button). */
  listSlug: string;
  /** SystemSetting key holding the extra deadline/update recipient emails. */
  recipientKey: string;
}

export const CRM_MODULES: Record<CrmModule, CrmModuleConfig> = {
  it: {
    module: "it",
    label: "IT CRM",
    listSlug: "it-crm",
    // Preserves the key shipped with the IT CRM feature (#896/#899).
    recipientKey: "it-crm.reminder_recipients",
  },
  general: {
    module: "general",
    label: "Project CRM",
    listSlug: "project-crm",
    recipientKey: "project-crm.reminder_recipients",
  },
  product: {
    module: "product",
    label: "Product CRM",
    listSlug: "product-crm",
    recipientKey: "product-crm.reminder_recipients",
  },
  legal: {
    module: "legal",
    label: "Legal CRM",
    listSlug: "legal-crm",
    recipientKey: "legal-crm.reminder_recipients",
  },
  accounting: {
    module: "accounting",
    label: "Accounting CRM",
    listSlug: "accounting-crm",
    recipientKey: "accounting-crm.reminder_recipients",
  },
  hr: {
    module: "hr",
    label: "HR CRM",
    listSlug: "hr-crm",
    recipientKey: "hr-crm.reminder_recipients",
  },
  qa: {
    module: "qa",
    label: "QA CRM",
    listSlug: "qa-crm",
    recipientKey: "qa-crm.reminder_recipients",
  },
  marketing: {
    module: "marketing",
    label: "Marketing CRM",
    listSlug: "partners",
    recipientKey: "marketing-crm.reminder_recipients",
  },
};

// The shared `projects` board teams that flow through projects.service.addTask.
// Maps a Project.team value to its CRM module. (qa + marketing are native and
// not in this map — they call the notifier from their own services.)
export const TEAM_TO_MODULE: Record<string, CrmModule> = {
  it: "it",
  general: "general",
  product: "product",
  legal: "legal",
  accounting: "accounting",
  hr: "hr",
};

export function moduleForTeam(
  team: string | null | undefined,
): CrmModule | null {
  if (!team) return null;
  return TEAM_TO_MODULE[team] ?? null;
}

// CRMs whose deadline reminders + update notifications are LIVE. This is the
// per-phase rollout toggle — enabling a CRM is (mostly) adding it here.
//   #896: it. Phase B: general (Project CRM) + hr (HR CRM).
//   Phase C pt1 (this): legal (Legal CRM) + accounting (Accounting CRM) —
//     native-mirror boards whose TASKS live in shared project_tasks, so their
//     task notifications + task due-date reminders are toggle-only. Their
//     project GO-LIVES stay on native tables (lazy mirror) and are NOT yet
//     reminded — that needs native reminder columns + a native scan (pt2).
//   Later: product (pure-native workspace, needs a native notifier adapter —
//     bucketed with qa / marketing), then qa / marketing.
export const NOTIFY_ENABLED_MODULES: readonly CrmModule[] = [
  "it",
  "general",
  "hr",
  "legal",
  "accounting",
];

// Board teams whose PROJECT rows live DIRECTLY in the shared `projects` table
// (no native mirror), so the reminder cron + bell scan `projects` for their
// go-lives. IT go-lives live on native `it_projects` and are scanned
// separately; legal/accounting go-lives live on THEIR native tables and need a
// native scan (pt2) — do NOT add them here or un-mirrored rows are missed.
export const SHARED_PROJECT_REMINDER_TEAMS: readonly string[] = [
  "general",
  "hr",
];

// Task due-date reminders scan `project_tasks` filtered to these teams. Every
// enabled board CRM whose tasks live in the shared project_tasks table belongs
// here — IT, general, hr, and the native-mirror boards legal + accounting
// (their tasks are worked on the shared /projects board).
export const TASK_REMINDER_TEAMS: readonly string[] = [
  "it",
  "general",
  "hr",
  "legal",
  "accounting",
];

// Resolve a board team to its module ONLY if that module's notifications are
// live — the gate used at the projects.service task-write call sites.
export function notifyModuleForTeam(
  team: string | null | undefined,
): CrmModule | null {
  const m = moduleForTeam(team);
  return m && NOTIFY_ENABLED_MODULES.includes(m) ? m : null;
}
