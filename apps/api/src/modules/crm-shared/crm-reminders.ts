import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { crmDeadlineReminderEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import {
  CRM_MODULES,
  type CrmModule,
  moduleForTeam,
  SHARED_PROJECT_REMINDER_TEAMS,
  TASK_REMINDER_TEAMS,
} from "@/modules/crm-shared/crm-modules";
import { getCrmReminderRecipients } from "@/modules/crm-shared/crm-recipients";

const DAY = 24 * 60 * 60 * 1000;
const boardLink = (slug: string, projectId: string) =>
  `${PORTAL_URL}/projects/${projectId}?from=${slug}`;
const taskLink = (slug: string, projectId: string, taskId: string) =>
  `${PORTAL_URL}/projects/${projectId}?task=${taskId}&from=${slug}`;

// Pre-deadline rungs (days out), fired nearest-first, plus one overdue rung.
const PROJECT_RUNGS = [30, 14, 7, 1] as const;
const TASK_RUNGS = [7, 3, 1] as const;

// A project is "done" (no reminders) in any of these statuses — mirrors the
// dashboard terminalStatuses set. Tasks are done in the terminal board column.
const PROJECT_TERMINAL = [
  "completed",
  "prod_integrated",
  "closed",
  "cancelled",
];
// Legal + Accounting native boards add "done" to their terminal set (Accounting
// uses a backlog…done kanban whose terminal column key is "done"; adding it is
// harmless for Legal, which never uses that status).
const NATIVE_PROJECT_TERMINAL = [...PROJECT_TERMINAL, "done"];
const TASK_TERMINAL = ["done"];

// Deadlines are @db.Date (date-only). Like the sibling it-billing cron this
// measures against server "now" — the daily run at Asia/Bangkok 08:00 makes an
// off-by-one across the dateline immaterial for a day-granularity reminder.
function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / DAY);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toMarkerSet(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string")
      : [],
  );
}

/**
 * Decide which rung (if any) to fire for a deadline.
 * - Overdue (daysLeft < 0): fire the single `<prefix>-overdue` marker once.
 * - Upcoming: fire the TIGHTEST rung already reached (smallest rung >= daysLeft)
 *   and mark every larger rung covered too, so a deadline that enters the
 *   window late (e.g. 5 days out) sends ONE "within a week" nudge rather than
 *   replaying the 30/14 rungs on later days.
 * Returns null when there's nothing new to fire.
 */
export function pickRung(
  daysLeft: number,
  rungs: readonly number[],
  sent: Set<string>,
  prefix: string,
): { fired: string; markers: string[] } | null {
  if (daysLeft < 0) {
    const m = `${prefix}-overdue`;
    return sent.has(m) ? null : { fired: m, markers: [m] };
  }
  const ascending = [...rungs].sort((a, b) => a - b);
  const applicable = ascending.find((r) => daysLeft <= r);
  if (applicable === undefined) return null; // still beyond the widest rung
  const fired = `${prefix}-${applicable}`;
  if (sent.has(fired)) return null;
  // Cover the fired rung + every larger (already-passed) rung.
  const markers = rungs
    .filter((r) => r >= applicable)
    .map((r) => `${prefix}-${r}`);
  return { fired, markers };
}

function dedupeEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const clean = e?.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

/**
 * Daily CRM deadline reminders across every enabled board CRM — project
 * go-lives + task due dates, upcoming (laddered) and overdue. Idempotent +
 * debounced via each row's `remindersSent` marker set, so re-running the same
 * day is a no-op.
 *
 * Project go-lives come from two sources: IT lives in the native `it_projects`
 * table; the shared-board CRMs (Project / HR) live directly in `projects`.
 * Task due dates for every enabled team live in the shared `project_tasks`.
 */
export async function processCrmDeadlineReminders(): Promise<{
  projectsNotified: number;
  tasksNotified: number;
  emailsSent: number;
}> {
  let projectsNotified = 0;
  let tasksNotified = 0;
  let emailsSent = 0;

  // Extra recipient list per module, fetched once (owner/assignees are added
  // per-row on top of these).
  const recipientCache = new Map<CrmModule, string[]>();
  const recipientsFor = async (m: CrmModule): Promise<string[]> => {
    const cached = recipientCache.get(m);
    if (cached) return cached;
    const list = (await getCrmReminderRecipients(m)).recipients;
    recipientCache.set(m, list);
    return list;
  };

  const projectHorizon = new Date(
    Date.now() + Math.max(...PROJECT_RUNGS) * DAY,
  );

  // ── IT project go-lives (native it_projects) ─────────────────
  const itProjects = await prisma.itProject.findMany({
    where: {
      archivedAt: null,
      status: { notIn: PROJECT_TERMINAL },
      OR: [
        { revisedGoLiveDate: { lte: projectHorizon } },
        { goLiveDate: { lte: projectHorizon } },
      ],
    },
    select: {
      id: true,
      name: true,
      goLiveDate: true,
      revisedGoLiveDate: true,
      remindersSent: true,
      owner: { select: { email: true } },
    },
  });

  for (const p of itProjects) {
    const deadline = p.revisedGoLiveDate ?? p.goLiveDate;
    if (!deadline) continue;
    const daysLeft = daysUntil(deadline);
    const sent = toMarkerSet(p.remindersSent);
    const rung = pickRung(daysLeft, PROJECT_RUNGS, sent, "golive");
    if (!rung) continue;

    const emails = dedupeEmails([
      p.owner?.email,
      ...(await recipientsFor("it")),
    ]);
    if (emails.length > 0) {
      const mail = crmDeadlineReminderEmail({
        crmLabel: CRM_MODULES.it.label,
        itemType: "project",
        title: p.name,
        projectName: p.name,
        deadlineLabel: "Go-live",
        dueDate: isoDay(deadline),
        daysLeft,
        portalUrl: boardLink(CRM_MODULES.it.listSlug, p.id),
      });
      void sendEmail({ to: emails, ...mail });
      emailsSent += 1;
    }

    await prisma.itProject.update({
      where: { id: p.id },
      data: {
        remindersSent: [...sent, ...rung.markers],
        lastReminderSentAt: new Date(),
      },
    });
    projectsNotified += 1;
  }

  // ── Shared-board project go-lives (Project / HR, live in `projects`) ──
  const boardProjects = await prisma.project.findMany({
    where: {
      team: { in: [...SHARED_PROJECT_REMINDER_TEAMS] },
      status: { notIn: PROJECT_TERMINAL },
      OR: [
        { revisedGoLiveDate: { lte: projectHorizon } },
        { goLiveDate: { lte: projectHorizon } },
      ],
    },
    select: {
      id: true,
      name: true,
      team: true,
      goLiveDate: true,
      revisedGoLiveDate: true,
      remindersSent: true,
      owner: { select: { email: true } },
    },
  });

  for (const p of boardProjects) {
    const module = moduleForTeam(p.team);
    if (!module) continue;
    const deadline = p.revisedGoLiveDate ?? p.goLiveDate;
    if (!deadline) continue;
    const daysLeft = daysUntil(deadline);
    const sent = toMarkerSet(p.remindersSent);
    const rung = pickRung(daysLeft, PROJECT_RUNGS, sent, "golive");
    if (!rung) continue;

    const emails = dedupeEmails([
      p.owner?.email,
      ...(await recipientsFor(module)),
    ]);
    if (emails.length > 0) {
      const cfg = CRM_MODULES[module];
      const mail = crmDeadlineReminderEmail({
        crmLabel: cfg.label,
        itemType: "project",
        title: p.name,
        projectName: p.name,
        deadlineLabel: "Go-live",
        dueDate: isoDay(deadline),
        daysLeft,
        portalUrl: boardLink(cfg.listSlug, p.id),
      });
      void sendEmail({ to: emails, ...mail });
      emailsSent += 1;
    }

    await prisma.project.update({
      where: { id: p.id },
      data: {
        remindersSent: [...sent, ...rung.markers],
        lastReminderSentAt: new Date(),
      },
    });
    projectsNotified += 1;
  }

  // ── Native-mirror project go-lives (Legal / Accounting) ─────
  // Their project rows live on native tables (lazy-mirrored into `projects`,
  // which never carries reminder state), so scan the native tables directly —
  // the IT pattern. Board deep-links go through the shared /projects board,
  // which heals the mirror on first open.
  const runNativeGoLiveScan = async (
    module: CrmModule,
    rows: Array<{
      id: string;
      name: string;
      goLiveDate: Date | null;
      revisedGoLiveDate: Date | null;
      remindersSent: unknown;
      owner: { email: string | null } | null;
    }>,
    persist: (id: string, remindersSent: string[]) => Promise<unknown>,
  ): Promise<void> => {
    const cfg = CRM_MODULES[module];
    const extra = await recipientsFor(module);
    for (const p of rows) {
      const deadline = p.revisedGoLiveDate ?? p.goLiveDate;
      if (!deadline) continue;
      const daysLeft = daysUntil(deadline);
      const sent = toMarkerSet(p.remindersSent);
      const rung = pickRung(daysLeft, PROJECT_RUNGS, sent, "golive");
      if (!rung) continue;

      const emails = dedupeEmails([p.owner?.email, ...extra]);
      if (emails.length > 0) {
        const mail = crmDeadlineReminderEmail({
          crmLabel: cfg.label,
          itemType: "project",
          title: p.name,
          projectName: p.name,
          deadlineLabel: "Go-live",
          dueDate: isoDay(deadline),
          daysLeft,
          portalUrl: boardLink(cfg.listSlug, p.id),
        });
        void sendEmail({ to: emails, ...mail });
        emailsSent += 1;
      }
      await persist(p.id, [...sent, ...rung.markers]);
      projectsNotified += 1;
    }
  };

  const legalProjects = await prisma.legalProject.findMany({
    where: {
      status: { notIn: NATIVE_PROJECT_TERMINAL },
      OR: [
        { revisedGoLiveDate: { lte: projectHorizon } },
        { goLiveDate: { lte: projectHorizon } },
      ],
    },
    select: {
      id: true,
      name: true,
      goLiveDate: true,
      revisedGoLiveDate: true,
      remindersSent: true,
      owner: { select: { email: true } },
    },
  });
  await runNativeGoLiveScan("legal", legalProjects, (id, remindersSent) =>
    prisma.legalProject.update({
      where: { id },
      data: { remindersSent, lastReminderSentAt: new Date() },
    }),
  );

  const accountingProjects = await prisma.accountingProject.findMany({
    where: {
      status: { notIn: NATIVE_PROJECT_TERMINAL },
      OR: [
        { revisedGoLiveDate: { lte: projectHorizon } },
        { goLiveDate: { lte: projectHorizon } },
      ],
    },
    select: {
      id: true,
      name: true,
      goLiveDate: true,
      revisedGoLiveDate: true,
      remindersSent: true,
      owner: { select: { email: true } },
    },
  });
  await runNativeGoLiveScan(
    "accounting",
    accountingProjects,
    (id, remindersSent) =>
      prisma.accountingProject.update({
        where: { id },
        data: { remindersSent, lastReminderSentAt: new Date() },
      }),
  );

  // ── Task due dates (all enabled board CRMs; live in project_tasks) ──
  const taskHorizon = new Date(Date.now() + Math.max(...TASK_RUNGS) * DAY);
  const tasks = await prisma.projectTask.findMany({
    where: {
      project: { team: { in: [...TASK_REMINDER_TEAMS] } },
      status: { notIn: TASK_TERMINAL },
      endDate: { lte: taskHorizon },
    },
    select: {
      id: true,
      title: true,
      endDate: true,
      remindersSent: true,
      projectId: true,
      project: { select: { name: true, team: true } },
      owner: { select: { email: true } },
      assignees: { select: { user: { select: { email: true } } } },
    },
  });

  for (const t of tasks) {
    if (!t.endDate) continue;
    const module = moduleForTeam(t.project.team);
    if (!module) continue;
    const daysLeft = daysUntil(t.endDate);
    const sent = toMarkerSet(t.remindersSent);
    const rung = pickRung(daysLeft, TASK_RUNGS, sent, "due");
    if (!rung) continue;

    const emails = dedupeEmails([
      t.owner?.email,
      ...t.assignees.map((a) => a.user.email),
      ...(await recipientsFor(module)),
    ]);
    if (emails.length > 0) {
      const cfg = CRM_MODULES[module];
      const mail = crmDeadlineReminderEmail({
        crmLabel: cfg.label,
        itemType: "task",
        title: t.title,
        projectName: t.project.name,
        deadlineLabel: "Due",
        dueDate: isoDay(t.endDate),
        daysLeft,
        portalUrl: taskLink(cfg.listSlug, t.projectId, t.id),
      });
      void sendEmail({ to: emails, ...mail });
      emailsSent += 1;
    }

    await prisma.projectTask.update({
      where: { id: t.id },
      data: {
        remindersSent: [...sent, ...rung.markers],
        lastReminderSentAt: new Date(),
      },
    });
    tasksNotified += 1;
  }

  return { projectsNotified, tasksNotified, emailsSent };
}
