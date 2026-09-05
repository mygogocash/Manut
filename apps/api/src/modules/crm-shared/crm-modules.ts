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
  | "marketing"
  | "sales";

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
    label: "Integration CRM",
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
  // Sales / Sales Revenue are reminder-only: single-owner to-do tasks with a
  // required dueDate, no board — so no update notifications and `listSlug`
  // is the module page path (their reminder links skip the /projects board).
  sales: {
    module: "sales",
    label: "Sales CRM",
    listSlug: "sales",
    recipientKey: "sales-crm.reminder_recipients",
  },
  // No `revenue` entry: the ARIA Revenue CRM was retired 2026-08-26 and its
  // deals migrated onto the Sales board tagged `aria`. Its reminder scans and
  // the `revenue-crm.reminder_recipients` SystemSetting died with it.
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
//   Phase C pt1: legal (Legal CRM) + accounting (Accounting CRM) —
//     native-mirror boards whose TASKS live in shared project_tasks, so their
//     task notifications + task due-date reminders are toggle-only.
//   Phase C pt2: legal/accounting native go-live scans.
//   Phase C pt3 (this): product — a native-mirror board like legal/accounting
//     (its list opens /projects/:id; the heal now mirrors product rows), so
//     shared-board hooks cover it. Plus qa — a pure-native workspace whose
//     notifications flow through the native adapter (`people`/`link` overrides
//     on notifyCrmTaskEvent). Sales / revenue are reminder-only (never here).
//   Later: marketing.
export const NOTIFY_ENABLED_MODULES: readonly CrmModule[] = [
  "it",
  "general",
  "hr",
  "legal",
  "accounting",
  "product",
  "qa",
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
// here — IT, general, hr, and the native-mirror boards legal + accounting +
// product (their tasks are worked on the shared /projects board). QA is NOT
// here: its tasks live only in qa_project_tasks and get a native scan.
export const TASK_REMINDER_TEAMS: readonly string[] = [
  "it",
  "general",
  "hr",
  "legal",
  "accounting",
  "product",
];

// Resolve a board team to its module ONLY if that module's notifications are
// live — the gate used at the projects.service task-write call sites.
export function notifyModuleForTeam(
  team: string | null | undefined,
): CrmModule | null {
  const m = moduleForTeam(team);
  return m && NOTIFY_ENABLED_MODULES.includes(m) ? m : null;
}
