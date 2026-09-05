import type { Db } from "@nexora/db";
import { processMissedChecks } from "../hrms/attendance/attendance-missed.service.js";
import { processEscalationReminders } from "../leave/leave.service.js";
import { processMonthlySubmissionReminders } from "../expenses/expenses.service.js";
import { syncBotRates, type BotFxEnv } from "../exchange-rates/bot-fx.service.js";
import { telemetryService } from "../telemetry/index.js";

export type CronEnv = BotFxEnv;

function stub(name: string, extra: Record<string, unknown> = {}) {
  return { skipped: true as const, reason: "stub" as const, job: name, ...extra };
}

export async function runJob(db: Db, name: string, env: CronEnv, body: unknown = {}) {
  const force: boolean | undefined =
    body && typeof body === "object" && (body as { force?: unknown }).force === true
      ? true
      : undefined;

  switch (name) {
    case "expense-monthly-reminders":
      return processMonthlySubmissionReminders(db, { force });
    case "leave-escalation":
      return processEscalationReminders(db);
    case "fx-sync":
      return syncBotRates(db, env);
    case "attendance-missed-checks":
      return processMissedChecks(db);
    case "accounting-status":
    case "it-billing-reminders":
    case "crm-deadline-reminders":
    case "stale-leads-digest":
    case "crm-email-sync":
    case "legal-expiry-digest":
    case "visa-expiry-reminders":
    case "ninety-day-reminders":
    case "sync-storage-snapshot":
    case "sync-telemetry":
      return telemetryService.runSnapshotSync(db);
    case "aria-knowledge-sync":
    case "aria-purge-pii":
    case "aria-daily-brief":
    case "ow-snapshot-refresh":
    case "marketing-drift-check":
    case "attendance-manager-alerts":
      return stub(name);
    default:
      return stub(name, { reason: "unknown-job" });
  }
}
