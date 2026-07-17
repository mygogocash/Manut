import { type Request, Router } from "express";

import { asyncHandler } from "@/core/middleware/async-handler";
import { syncCrmEmailsForAllUsers } from "@/modules/accounts/crm-email-sync.service";
import { storageSnapshotService } from "@/modules/admin/usage/storage-snapshot.service";
import { processCrmDeadlineReminders } from "@/modules/crm-shared/crm-reminders";
import { botFxService } from "@/modules/exchange-rates/bot-fx.service";
import { expensesService } from "@/modules/expenses/expenses.service";
import { attendanceMissedService } from "@/modules/hrms/attendance-missed.service";
import { attendanceNotificationService } from "@/modules/hrms/attendance-notification.service";
import { processBillingReminders } from "@/modules/it-billing/it-billing.reminders";
import { leadService } from "@/modules/leads/leads.service";
import { leaveService } from "@/modules/leave/leave.service";
import { legalService } from "@/modules/legal/legal.service";
import { ninetyDayService } from "@/modules/ninety-day/ninety-day.service";
import { telemetryService } from "@/modules/telemetry";
import { visaService } from "@/modules/visa/visa.service";

const router = Router();

function verifyCronSecret(provided: string | undefined): provided is string {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 8) return false;
  return provided === secret;
}

function readSecret(req: Request): string | undefined {
  return (
    req.header("x-cron-secret") ??
    req.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    undefined
  );
}

// Monthly expense submission reminders — runs on the 22nd (Asia/Bangkok).
// Thailand employees get allowance copy; India and other entities get
// reimbursement copy. Skips users who already filed for the period.
// Schedule: `0 9 22 * *` in Asia/Bangkok. Body `{ "force": true }` bypasses
// the day guard for manual verification.
router.post(
  "/expense-monthly-reminders",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const force =
      req.body &&
      typeof req.body === "object" &&
      (req.body as { force?: unknown }).force === true;
    const data = await expensesService.processMonthlySubmissionReminders({
      force,
    });
    res.json({ data });
  }),
);

// IT Operations billing reminders: renewal (30/15/7) + payment-due (7).
// Idempotent + debounced per subscription. Schedule daily, e.g. `0 8 * * *`.
router.post(
  "/it-billing-reminders",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await processBillingReminders();
    res.json({ data });
  }),
);

// CRM deadline reminders across every enabled board CRM (IT + Project + HR …):
// project go-live (30/14/7/1 + overdue) + task due dates (7/3/1 + overdue).
// Idempotent + debounced per row (reminders_sent). Schedule: `0 8 * * *`
// Asia/Bangkok. Safe to re-run. The legacy `/it-crm-deadline-reminders` path
// is kept as an alias so an already-provisioned Cloud Scheduler job keeps
// firing — both hit the same generalized worker.
const crmDeadlineReminderHandler = asyncHandler(async (req, res) => {
  if (!verifyCronSecret(readSecret(req))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const data = await processCrmDeadlineReminders();
  res.json({ data });
});
router.post("/crm-deadline-reminders", crmDeadlineReminderHandler);
router.post("/it-crm-deadline-reminders", crmDeadlineReminderHandler);

router.post(
  "/leave-escalation",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await leaveService.processEscalationReminders();
    res.json({ data });
  }),
);

// Daily FX sync from Bank of Thailand → upserts <CUR>→THB exchange rates
// so the expense module can convert mixed-currency reports. No-op
// (configured: false) until BOT_API_CLIENT_ID is set. Schedule daily
// ~07:00 SGT (after BOT publishes the daily average). Idempotent.
router.post(
  "/fx-sync",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await botFxService.syncBotRates();
    res.json({ data });
  }),
);

// Daily stale-lead digest. Caller schedules this
// once per day (e.g. Cloud Scheduler). The job sends one email per owner
// with at least one stale lead and returns counters for monitoring.
router.post(
  "/stale-leads-digest",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await leadService.processStaleLeadDigest();
    res.json({ data });
  }),
);

// Sales CRM email auto-sync. For every
// user with a connected Gmail account, scans messages newer than the
// per-user cursor, matches recipients against `Contact.email`, and
// logs a `CrmActivity` for each matched account. Idempotent via
// `CrmActivity.externalRef` unique constraint. Recommended schedule:
// every 10 min in Asia/Bangkok.
router.post(
  "/crm-email-sync",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await syncCrmEmailsForAllUsers();
    res.json({ data });
  }),
);

// Daily legal-document expiry digest. Caller schedules this once per
// day. Job sends one email per owner with all of their soon-to-expire
// docs grouped together; counters returned for monitoring.
router.post(
  "/legal-expiry-digest",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await legalService.processExpiryDigest();
    res.json({ data });
  }),
);

// Daily visa + work-permit expiry reminders (90-day window). Caller
// schedules this once per day (e.g. Cloud Scheduler at 08:00 SGT). The
// job emails the employee for each active visa_record whose visa or
// work permit will expire within the window; rows are stamped with
// `last_reminder_sent_at` so repeat runs don't double-send within the
// cooldown period. Optional `VISA_REMINDER_CC` carbon-copies HR.
router.post(
  "/visa-expiry-reminders",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await visaService.processExpiryReminders();
    res.json({ data });
  }),
);

// Daily 90-day immigration (TM.47) reminders. Fires at T-21 / T-15
// before the 90-day mark and once during the T+7 final report window.
// Schedule via Cloud Scheduler at 08:00 SGT, same cadence as the visa
// expiry cron above.
router.post(
  "/ninety-day-reminders",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await ninetyDayService.dispatchReminders();
    res.json({ data });
  }),
);

// Daily Supabase Storage snapshot — walks every bucket, sums object sizes,
// writes one row per bucket into `storage_snapshots`. The Workspace Usage
// admin screen reads the latest row per bucket so dashboards stay cheap.
// Schedule via Cloud Scheduler at quiet hours (e.g. 04:30 SGT — after the
// PostHog sync).
router.post(
  "/sync-storage-snapshot",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await storageSnapshotService.refresh();
    res.json({ data });
  }),
);

// Daily analytics snapshot sync. The replacement deployment will enqueue this
// from a Cloudflare Cron Trigger; no inherited scheduler is active.
router.post(
  "/sync-telemetry",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await telemetryService.runSnapshotSync();
    res.json({ data });
  }),
);

// Missed check-in/out, consecutive absences, and manager attendance alerts.
// Schedule hourly or after shift start (e.g. 10:00 and 19:00 local).
router.post(
  "/attendance-missed-checks",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await attendanceMissedService.runMissedAttendanceChecks();
    res.json({ data });
  }),
);

// Daily attendance manager alerts (late arrivals, pending corrections,
// high absenteeism). Schedule once per day after shift start (e.g. 10:00).
router.post(
  "/attendance-manager-alerts",
  asyncHandler(async (req, res) => {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    await attendanceNotificationService.runDailyManagerAlerts();
    res.json({ data: { ok: true } });
  }),
);

export default router;
