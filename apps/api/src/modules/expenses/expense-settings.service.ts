/**
 * Expense admin settings: approval chain configuration, notification
 * recipients, exchange rates, and the monthly reminder cron worker.
 */

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { expenseMonthlySubmissionReminderEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import {
  currentExpensePeriodInTimezone,
  datePartsInTimezone,
  EXPENSE_NOTIFICATION_KEY,
  EXPENSE_REMINDER_DAY_OF_MONTH,
  EXPENSE_REMINDER_TIME,
  EXPENSE_REMINDER_TIMEZONE,
  expensePeriodLabel,
  type ExpenseRecipient,
  type ExpenseRecipientMode,
  expenseReminderVariantForEntityCode,
  FILED_EXPENSE_REPORT_STATUSES,
  loadExpenseNotificationRecipients,
} from "@/modules/expenses/expense-shared";
import { expensesRepository } from "@/modules/expenses/expenses.repository";
import type {
  CreateExpenseApprovalStepInput,
  ReorderExpenseApprovalStepsInput,
  UpdateExpenseApprovalStepInput,
  UpsertExchangeRateBody,
  UpsertExpenseReminderSettingsInput,
} from "@/modules/expenses/expenses.validation";

// ── Exchange rates ────────────────────────────────────────────────

async function listExchangeRates(baseCurrency: string, date?: string) {
  const rates = await expensesRepository.findExchangeRates(baseCurrency, date);
  return { data: rates };
}

async function upsertExchangeRate(input: UpsertExchangeRateBody) {
  return expensesRepository.upsertExchangeRate(input);
}

async function convertExpenseAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
) {
  const result = await expensesRepository.convertAmount(
    amount,
    fromCurrency,
    toCurrency,
  );
  if (!result) {
    throw new BadRequestException(
      `No exchange rate found for ${fromCurrency} → ${toCurrency}`,
    );
  }
  return { data: result };
}

// ── Approval chain admin ──────────────────────────────────────────

async function listApprovalSteps() {
  return expensesRepository.findApprovalSteps();
}

async function createApprovalStep(input: CreateExpenseApprovalStepInput) {
  const order = await expensesRepository.nextStepOrder();
  return expensesRepository.createApprovalStep({
    order,
    name: input.name,
    description: input.description,
    approverType: input.approverType,
    isActive: input.isActive,
    skipWhenSubmitterIds: input.skipWhenSubmitterIds,
    onlyWhenSubmitterIds: input.onlyWhenSubmitterIds,
    categoryFilter: input.categoryFilter,
    amountMinBaht: input.amountMinBaht ?? null,
    amountMaxBaht: input.amountMaxBaht ?? null,
    ...(input.approverType === "user" && input.approverUserId
      ? { approverUser: { connect: { id: input.approverUserId } } }
      : {}),
  });
}

async function updateApprovalStep(
  id: string,
  input: UpdateExpenseApprovalStepInput,
) {
  const existing = await expensesRepository.findApprovalStepById(id);
  if (!existing) throw new NotFoundException("Approval step not found");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.order !== undefined) data.order = input.order;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.skipWhenSubmitterIds !== undefined) {
    data.skipWhenSubmitterIds = input.skipWhenSubmitterIds;
  }
  if (input.onlyWhenSubmitterIds !== undefined) {
    data.onlyWhenSubmitterIds = input.onlyWhenSubmitterIds;
  }
  if (input.categoryFilter !== undefined) {
    data.categoryFilter = input.categoryFilter;
  }
  if (input.amountMinBaht !== undefined) {
    data.amountMinBaht = input.amountMinBaht;
  }
  if (input.amountMaxBaht !== undefined) {
    data.amountMaxBaht = input.amountMaxBaht;
  }

  const nextType = input.approverType ?? existing.approverType;
  if (input.approverType !== undefined) data.approverType = nextType;

  let nextApproverId: string | null = null;
  if (nextType === "user") {
    const userId = input.approverUserId ?? existing.approverUserId;
    if (!userId) {
      throw new BadRequestException(
        "approverUserId is required when approverType is 'user'",
      );
    }
    data.approverUser = { connect: { id: userId } };
    nextApproverId = userId;
  } else if (nextType === "manager") {
    data.approverUser = { disconnect: true };
    nextApproverId = null;
  }

  const updated = await expensesRepository.updateApprovalStep(id, data);

  // Cascade approver change to still-pending decisions snapshotted
  // before this edit — mirrors travel chain behaviour.
  await expensesRepository.reassignPendingDecisionsByStepName(
    existing.name,
    nextApproverId,
  );

  return updated;
}

async function deleteApprovalStep(id: string) {
  const existing = await expensesRepository.findApprovalStepById(id);
  if (!existing) throw new NotFoundException("Approval step not found");
  return expensesRepository.deleteApprovalStep(id);
}

async function reorderApprovalSteps(input: ReorderExpenseApprovalStepsInput) {
  const all = await expensesRepository.findApprovalSteps();
  if (all.length !== input.orderedIds.length) {
    throw new BadRequestException(
      "orderedIds must include every existing step exactly once",
    );
  }
  const known = new Set(all.map((s) => s.id));
  for (const id of input.orderedIds) {
    if (!known.has(id)) {
      throw new BadRequestException(
        `Unknown approval step id in reorder: ${id}`,
      );
    }
  }
  return expensesRepository.reorderApprovalSteps(input.orderedIds);
}

// ── Notification recipients ───────────────────────────────────────

async function getNotificationRecipients() {
  return { recipients: await loadExpenseNotificationRecipients() };
}

async function setNotificationRecipients(rawRecipients: unknown[]) {
  const seen = new Set<string>();
  const cleaned: ExpenseRecipient[] = [];
  for (const raw of rawRecipients) {
    // Accept either legacy plain-string entries or the new object shape.
    let email: string | undefined;
    let mode: ExpenseRecipientMode = "approved";
    if (typeof raw === "string") {
      email = raw;
    } else if (raw && typeof raw === "object" && "email" in raw) {
      const rec = raw as { email: unknown; mode?: unknown };
      if (typeof rec.email === "string") email = rec.email;
      if (rec.mode === "everything") mode = "everything";
    }
    if (!email) continue;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new BadRequestException(`Invalid email: ${email}`);
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push({ email: trimmed, mode });
  }
  await prisma.systemSetting.upsert({
    where: { key: EXPENSE_NOTIFICATION_KEY },
    update: { value: cleaned as unknown as object },
    create: {
      key: EXPENSE_NOTIFICATION_KEY,
      value: cleaned as unknown as object,
    },
  });
  return { recipients: cleaned };
}

// ── Reminder settings ─────────────────────────────────────────────

const EXPENSE_REMINDER_SETTINGS_KEY = "expense.reminder_settings";

export interface ExpenseReminderSettings {
  reminderDay: number;
  reminderTime: string;
  reminderTimezone: string;
  enableThailand: boolean;
  enableInternational: boolean;
}

const DEFAULT_REMINDER_SETTINGS: ExpenseReminderSettings = {
  reminderDay: EXPENSE_REMINDER_DAY_OF_MONTH,
  reminderTime: EXPENSE_REMINDER_TIME,
  reminderTimezone: EXPENSE_REMINDER_TIMEZONE,
  enableThailand: true,
  enableInternational: true,
};

async function loadReminderSettings(): Promise<ExpenseReminderSettings> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: EXPENSE_REMINDER_SETTINGS_KEY },
  });
  if (
    !row?.value ||
    typeof row.value !== "object" ||
    Array.isArray(row.value)
  ) {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
  const v = row.value as Record<string, unknown>;
  // Validate stored timezone is still a valid IANA name; fall back on error.
  let tz = DEFAULT_REMINDER_SETTINGS.reminderTimezone;
  if (typeof v.reminderTimezone === "string" && v.reminderTimezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: v.reminderTimezone });
      tz = v.reminderTimezone;
    } catch {
      /* keep default */
    }
  }
  return {
    reminderDay:
      typeof v.reminderDay === "number" &&
      v.reminderDay >= 1 &&
      v.reminderDay <= 31
        ? v.reminderDay
        : DEFAULT_REMINDER_SETTINGS.reminderDay,
    reminderTime:
      typeof v.reminderTime === "string" && /^\d{2}:\d{2}$/.test(v.reminderTime)
        ? v.reminderTime
        : DEFAULT_REMINDER_SETTINGS.reminderTime,
    reminderTimezone: tz,
    enableThailand:
      typeof v.enableThailand === "boolean"
        ? v.enableThailand
        : DEFAULT_REMINDER_SETTINGS.enableThailand,
    enableInternational:
      typeof v.enableInternational === "boolean"
        ? v.enableInternational
        : DEFAULT_REMINDER_SETTINGS.enableInternational,
  };
}

async function getReminderSettings(): Promise<{
  settings: ExpenseReminderSettings;
}> {
  return { settings: await loadReminderSettings() };
}

async function setReminderSettings(
  input: UpsertExpenseReminderSettingsInput,
): Promise<{ settings: ExpenseReminderSettings }> {
  const settings: ExpenseReminderSettings = {
    reminderDay: input.reminderDay,
    reminderTime: input.reminderTime,
    reminderTimezone: input.reminderTimezone,
    enableThailand: input.enableThailand,
    enableInternational: input.enableInternational,
  };
  await prisma.systemSetting.upsert({
    where: { key: EXPENSE_REMINDER_SETTINGS_KEY },
    update: { value: settings as unknown as object },
    create: {
      key: EXPENSE_REMINDER_SETTINGS_KEY,
      value: settings as unknown as object,
    },
  });
  return { settings };
}

// ── Monthly reminder cron ─────────────────────────────────────────

/**
 * Monthly expense submission reminders.
 * Intended to run on the reminder day (default 22) via Cloud Scheduler
 * (`Asia/Bangkok`). Skips employees who already filed the current period.
 * Pass `{ force: true }` to bypass the day-of-month guard for testing.
 */
async function processMonthlySubmissionReminders(
  opts: { force?: boolean } = {},
) {
  const settings = await loadReminderSettings();
  const now = new Date();

  const tz = settings.reminderTimezone;

  // Check whether today is the configured reminder day in the configured timezone.
  const isReminderDay =
    Number(datePartsInTimezone(now, tz).day) === settings.reminderDay;

  if (!opts.force && !isReminderDay) {
    return {
      skipped: true as const,
      reason: "not_reminder_day" as const,
      dayOfMonth: Number(datePartsInTimezone(now, tz).day),
      period: currentExpensePeriodInTimezone(now, tz),
    };
  }

  // Neither variant enabled — nothing to do.
  if (!settings.enableThailand && !settings.enableInternational) {
    return {
      skipped: true as const,
      reason: "all_variants_disabled" as const,
      dayOfMonth: Number(datePartsInTimezone(now, tz).day),
      period: currentExpensePeriodInTimezone(now, tz),
    };
  }

  const period = currentExpensePeriodInTimezone(now, tz);
  const periodLabel = expensePeriodLabel(period);
  const portalUrl = `${PORTAL_URL}/expenses`;

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { not: "" },
      entityId: { not: null },
      entity: { isActive: true },
    },
    select: {
      id: true,
      name: true,
      email: true,
      entity: { select: { code: true, name: true } },
    },
  });

  if (users.length === 0) {
    return {
      skipped: false as const,
      period,
      thailandReminders: 0,
      internationalReminders: 0,
      emailsSent: 0,
      alreadyFiled: 0,
      failed: 0,
    };
  }

  const filedReports = await prisma.expenseReport.findMany({
    where: {
      period,
      employeeId: { in: users.map((u) => u.id) },
      status: { in: [...FILED_EXPENSE_REPORT_STATUSES] },
    },
    select: { employeeId: true },
  });
  const filedEmployeeIds = new Set(filedReports.map((r) => r.employeeId));

  let thailandReminders = 0;
  let internationalReminders = 0;
  let emailsSent = 0;
  let alreadyFiled = 0;
  let failed = 0;

  for (const user of users) {
    if (filedEmployeeIds.has(user.id)) {
      alreadyFiled++;
      continue;
    }

    const variant = expenseReminderVariantForEntityCode(user.entity?.code);

    // Skip disabled variants.
    if (variant === "thailand" && !settings.enableThailand) continue;
    if (variant === "international" && !settings.enableInternational) continue;

    if (variant === "thailand") thailandReminders++;
    else internationalReminders++;

    const email = expenseMonthlySubmissionReminderEmail({
      employeeName: user.name,
      periodLabel,
      portalUrl,
      variant,
    });

    try {
      await sendEmail({ to: user.email, ...email });
      emailsSent++;
    } catch (err) {
      failed++;
      logger.error("expense monthly reminder send failed", {
        userId: user.id,
        err,
      });
    }
  }

  return {
    skipped: false as const,
    period,
    thailandReminders,
    internationalReminders,
    emailsSent,
    alreadyFiled,
    failed,
    eligible: users.length,
  };
}

export const expenseSettingsService = {
  listExchangeRates,
  upsertExchangeRate,
  convertExpenseAmount,
  listApprovalSteps,
  createApprovalStep,
  updateApprovalStep,
  deleteApprovalStep,
  reorderApprovalSteps,
  getNotificationRecipients,
  setNotificationRecipients,
  getReminderSettings,
  setReminderSettings,
  processMonthlySubmissionReminders,
};
