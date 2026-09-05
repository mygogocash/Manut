import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { ninetyDayReminderEmail } from "@/infrastructure/email/templates";
import {
  createSignedUrl,
  parseStorageUrl,
} from "@/infrastructure/storage/supabase-storage";
import { PORTAL_URL } from "@/lib/portal-url";
import { ninetyDayRepository } from "@/modules/ninety-day/ninety-day.repository";
import type {
  CreateNinetyDayInput,
  NinetyDayQuery,
  UpdateNinetyDayInput,
} from "@/modules/ninety-day/ninety-day.validation";
import { NINETY_DAY_STATUSES } from "@/modules/ninety-day/ninety-day.validation";

// Local copies of the visa-import helpers (UUID test, cell coercion,
// name normaliser). Duplicated here on purpose so the 90-day module
// doesn't reach across module boundaries into `visa.service` just for
// four small utilities — saves the import-cycle risk if visa ever
// imports anything back.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return "";
}

function normaliseName(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

// Accepts ISO YYYY-MM-DD, Date objects (SheetJS `cellDates: true`),
// `dd/mm/yyyy`, and `dd-mm-yyyy`. Returns YYYY-MM-DD or null.
function pickDate(
  row: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    if (v instanceof Date && !isNaN(v.getTime())) {
      return v.toISOString().slice(0, 10);
    }
    const raw = String(v).trim();
    if (!raw) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const year = yyyy!.length === 2 ? `20${yyyy}` : yyyy;
      const iso = `${year}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
      const parsed = new Date(iso);
      if (!isNaN(parsed.getTime())) return iso;
    }
    return null;
  }
  return null;
}

interface ParsedRow {
  rowNumber: number;
  employeeIdRaw: string;
  employeeEmail: string;
  employeeName: string;
  employeeCode: string;
  lastArrivalDate: string;
  status: (typeof NINETY_DAY_STATUSES)[number];
  notes: string;
}

interface ResolvedRow extends ParsedRow {
  employeeId: string;
}

// Reminder milestones per HR (Tanny, May 2026, xlsx columns):
//   T-21d  — first heads-up
//   T-15d  — advance submission window opens
//   T+7d   — final report day (TM.47 deadline is +7 days past 90)
// `dispatchReminders` walks active rows and stamps
// `lastReminderMilestoneDays` so the cron only re-fires when the row
// crosses into a closer bucket. See `currentMilestone()` for the
// bucket boundaries.

const RECIPIENTS_SETTING_KEY = "visa.notification_recipients";

// xlsx hardcodes Tanatsha + Sarah as the always-CC pair. The setting
// key above is shared with the visa-expiry workflow; both reuse the
// same HR distribution. Env fallback keeps ops bootstrap working
// before the UI lands.
async function loadCcRecipients(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: RECIPIENTS_SETTING_KEY },
  });
  const fromSetting =
    row && Array.isArray(row.value)
      ? row.value.filter((v): v is string => typeof v === "string")
      : [];
  const fromEnv = (
    process.env.VISA_90DAY_REMINDER_CC ??
    process.env.VISA_REMINDER_CC ??
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...fromSetting, ...fromEnv]));
}

function receiptColumns(
  receipt: CreateNinetyDayInput["receipt"] | UpdateNinetyDayInput["receipt"],
):
  | {
      receiptUrl: string | null;
      receiptName: string | null;
      receiptMimeType: string | null;
    }
  | undefined {
  if (receipt === undefined) return undefined;
  if (receipt === null) {
    return { receiptUrl: null, receiptName: null, receiptMimeType: null };
  }
  return {
    receiptUrl: receipt.url,
    receiptName: receipt.name,
    receiptMimeType: receipt.mimeType ?? null,
  };
}

function parseDateOnly(iso: string): Date {
  // Treat the YYYY-MM-DD input as UTC midnight so day math is stable
  // regardless of server tz. Prisma's `@db.Date` round-trips at UTC.
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

// Compute the "current milestone" for a row whose due date is `dueDate`.
// `offsetDays = daysBetween(today, dueDate)` — positive while pre-due,
// negative once past. We surface the *closest* (smallest by absolute
// distance from today, but moving forward in time) milestone the row
// has entered, mirroring the visa-expiry pattern.
function currentMilestone(offsetDays: number): number | null {
  // Active windows:
  //   T-21d  → fire if 7 < offsetDays <= 21
  //   T-15d  → fire if 0 <= offsetDays <= 15 (subsumes the next 7-day stretch)
  //   T+7d   → fire if -7 <= offsetDays < 0 (after the 90-day mark)
  // Bucket value returned in days-from-due, smaller = closer to/past due.
  if (offsetDays > 21 || offsetDays < -7) return null;
  if (offsetDays <= -1) return -7;
  if (offsetDays <= 15) return 15;
  return 21;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export class NinetyDayService {
  async list(query: NinetyDayQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await ninetyDayRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data: data.map((row) => this.serialize(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const row = await ninetyDayRepository.findById(id);
    if (!row) throw new NotFoundException("90-day notification not found");
    return this.serialize(row);
  }

  async create(input: CreateNinetyDayInput) {
    const arrival = parseDateOnly(input.lastArrivalDate);
    const due = addDays(arrival, 89);
    const created = await ninetyDayRepository.create({
      employeeId: input.employeeId,
      entityId: input.entityId || null,
      holderType: input.holderType,
      holderName:
        input.holderType === "dependent" ? (input.holderName ?? null) : null,
      holderRelationship:
        input.holderType === "dependent"
          ? (input.holderRelationship ?? null)
          : null,
      lastArrivalDate: arrival,
      dueDate: due,
      status: input.status,
      notes: input.notes,
      ...(input.receipt !== undefined ? receiptColumns(input.receipt) : {}),
    });
    return this.serialize(created);
  }

  async update(id: string, input: UpdateNinetyDayInput) {
    await this.getById(id);
    const data: Record<string, unknown> = {};
    if (input.lastArrivalDate !== undefined) {
      const arrival = parseDateOnly(input.lastArrivalDate);
      data.lastArrivalDate = arrival;
      data.dueDate = addDays(arrival, 89);
      // Reset reminder bookkeeping — a new arrival date means new
      // milestones; we should re-fire from scratch instead of skipping
      // because the old stamp says "already pinged at T-15".
      data.lastReminderMilestoneDays = null;
      data.lastReminderSentAt = null;
    }
    if (input.entityId !== undefined) data.entityId = input.entityId || null;
    if (input.holderType !== undefined) {
      data.holderType = input.holderType;
      // Switching back to employee blanks the dependent metadata so a
      // stale name doesn't keep displaying.
      if (input.holderType === "employee") {
        data.holderName = null;
        data.holderRelationship = null;
      }
    }
    if (input.holderName !== undefined) data.holderName = input.holderName;
    if (input.holderRelationship !== undefined) {
      data.holderRelationship = input.holderRelationship;
    }
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes;
    const receipt = receiptColumns(input.receipt);
    if (receipt !== undefined) Object.assign(data, receipt);
    const updated = await ninetyDayRepository.update(id, data);
    return this.serialize(updated);
  }

  async delete(id: string) {
    await this.getById(id);
    await ninetyDayRepository.delete(id);
    return { success: true };
  }

  async getReceiptDownloadUrl(id: string) {
    const row = await ninetyDayRepository.findById(id);
    if (!row?.receiptUrl) {
      throw new NotFoundException("No receipt attached to this record");
    }
    const name = row.receiptName ?? "receipt";
    const parsed = parseStorageUrl(row.receiptUrl);
    if (!parsed) {
      return { url: row.receiptUrl, name };
    }
    const signed = await createSignedUrl(parsed.bucket, parsed.path, 300);
    return { url: signed, name };
  }

  // Bulk-import preview: validate rows + resolve each one to a real
  // User. Returns the same shape the visa importer uses so the FE
  // dialog can reuse the existing surface.
  async previewImport(rows: Array<Record<string, unknown>>) {
    const errors: Array<{ row: number; message: string }> = [];
    const parsed: ParsedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const row = rows[i]!;

      const employeeIdRaw = pickString(
        row,
        "employeeId",
        "employee_id",
        "Employee ID",
        "Employee Id",
      );
      const employeeEmail = pickString(
        row,
        "employeeEmail",
        "Email",
        "email",
      ).toLowerCase();
      const employeeName = pickString(
        row,
        "employeeName",
        "Employee Name",
        "Name",
        "name",
      );
      const employeeCode =
        employeeIdRaw && !UUID_REGEX.test(employeeIdRaw) ? employeeIdRaw : "";

      if (!employeeIdRaw && !employeeEmail && !employeeName) {
        errors.push({
          row: rowNumber,
          message: "Missing employee — provide ID, email, or full name",
        });
        continue;
      }

      const arrival = pickDate(
        row,
        "lastArrivalDate",
        "last_arrival_date",
        "Last Arrival Date",
        "Arrival Date",
        "arrivalDate",
      );
      if (!arrival) {
        errors.push({
          row: rowNumber,
          message: "Missing or invalid last arrival date (use YYYY-MM-DD)",
        });
        continue;
      }

      const statusRaw =
        pickString(row, "status", "Status").toLowerCase() || "pending";
      const status = (NINETY_DAY_STATUSES as ReadonlyArray<string>).includes(
        statusRaw,
      )
        ? (statusRaw as (typeof NINETY_DAY_STATUSES)[number])
        : "pending";

      const notes = pickString(row, "notes", "Notes");

      parsed.push({
        rowNumber,
        employeeIdRaw,
        employeeEmail,
        employeeName,
        employeeCode,
        lastArrivalDate: arrival,
        status,
        notes,
      });
    }

    const valid: ResolvedRow[] = [];
    if (parsed.length > 0) {
      const ids = Array.from(
        new Set(
          parsed
            .map((p) => p.employeeIdRaw)
            .filter((v) => v && UUID_REGEX.test(v)),
        ),
      );
      const emails = Array.from(
        new Set(parsed.map((p) => p.employeeEmail).filter(Boolean)),
      );
      const codes = Array.from(
        new Set(parsed.map((p) => p.employeeCode).filter(Boolean)),
      );
      const needsNameLookup = parsed.some(
        (p) =>
          !p.employeeIdRaw &&
          !p.employeeEmail &&
          !p.employeeCode &&
          p.employeeName,
      );

      const [byId, byEmail, byCode, allActive] = await Promise.all([
        ninetyDayRepository.findUsersByIds(ids),
        ninetyDayRepository.findUsersByEmails(emails),
        ninetyDayRepository.findUsersByEmployeeCodes(codes),
        needsNameLookup
          ? ninetyDayRepository.findActiveUsersForBulkMatch()
          : Promise.resolve(
              [] as Array<{
                id: string;
                name: string;
                email: string;
                employeeId: string | null;
              }>,
            ),
      ]);

      const userById = new Map(byId.map((u) => [u.id, u] as const));
      const userByEmail = new Map(
        byEmail.map((u) => [u.email.toLowerCase(), u] as const),
      );
      const userByCode = new Map(
        byCode
          .filter((u) => u.employeeId)
          .map((u) => [u.employeeId as string, u] as const),
      );
      const userByNormalisedName = new Map(
        allActive.map((u) => [normaliseName(u.name), u] as const),
      );

      for (const p of parsed) {
        let user:
          | {
              id: string;
              name: string;
              email: string;
              employeeId: string | null;
            }
          | undefined;

        if (p.employeeIdRaw && UUID_REGEX.test(p.employeeIdRaw)) {
          user = userById.get(p.employeeIdRaw);
        }
        if (!user && p.employeeCode) user = userByCode.get(p.employeeCode);
        if (!user && p.employeeEmail) user = userByEmail.get(p.employeeEmail);
        if (!user && p.employeeName) {
          user = userByNormalisedName.get(normaliseName(p.employeeName));
        }
        if (!user) {
          errors.push({
            row: p.rowNumber,
            message: `Could not match employee — ${
              p.employeeIdRaw || p.employeeEmail || p.employeeName || "(blank)"
            }`,
          });
          continue;
        }
        valid.push({ ...p, employeeId: user.id });
      }
    }

    return {
      valid: valid.map((v) => ({
        rowIndex: v.rowNumber,
        employeeId: v.employeeId,
        lastArrivalDate: v.lastArrivalDate,
        status: v.status,
        notes: v.notes,
      })),
      errors,
      totalRows: rows.length,
      validCount: valid.length,
      errorCount: errors.length,
    };
  }

  async commitImport(rows: Array<Record<string, unknown>>) {
    const preview = await this.previewImport(rows);
    if (preview.errorCount > 0) {
      throw new BadRequestException(
        `${preview.errorCount} rows have errors. Fix them and try again.`,
      );
    }

    let imported = 0;
    const failures: Array<{ row: number; message: string }> = [];

    for (const row of preview.valid) {
      try {
        const arrival = parseDateOnly(row.lastArrivalDate);
        const due = addDays(arrival, 89);
        await ninetyDayRepository.create({
          employeeId: row.employeeId,
          lastArrivalDate: arrival,
          dueDate: due,
          status: row.status,
          notes: row.notes || null,
        });
        imported++;
      } catch (err) {
        failures.push({
          row: row.rowIndex,
          message: err instanceof Error ? err.message : "Insert failed",
        });
      }
    }

    if (failures.length > 0) {
      throw new BadRequestException(
        `${failures.length} rows failed to insert: ${failures
          .map((f) => `row ${f.row} (${f.message})`)
          .join("; ")}`,
      );
    }

    return { imported };
  }

  // Daily cron dispatcher. Walks every row whose due date is within
  // [today-7, today+21] and emails applicant + HR cc when the row
  // enters a new milestone bucket. Status "approved" / "no_required"
  // is skipped — HR has signed off, no reminder needed.
  async dispatchReminders() {
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const windowStart = addDays(todayUtc, -7);
    const windowEnd = addDays(todayUtc, 21);

    const rows = await prisma.ninetyDayNotification.findMany({
      where: {
        status: "pending",
        dueDate: { gte: windowStart, lte: windowEnd },
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
      },
    });

    const hrCc = await loadCcRecipients();
    let sent = 0;
    let skipped = 0;

    for (const r of rows) {
      const offsetDays = daysBetween(todayUtc, r.dueDate);
      const milestone = currentMilestone(offsetDays);
      if (milestone === null) {
        skipped++;
        continue;
      }
      if (
        r.lastReminderMilestoneDays !== null &&
        r.lastReminderMilestoneDays !== undefined &&
        r.lastReminderMilestoneDays <= milestone
      ) {
        // Already fired at this or a closer milestone — don't re-ping.
        skipped++;
        continue;
      }
      if (!r.employee?.email) {
        skipped++;
        continue;
      }

      // For a dependent row the email still routes to the sponsor
      // employee's inbox (HR's reminder lands with them), but the
      // greeting + body name the actual applicant so the recipient
      // immediately sees who the filing is for.
      const applicantName =
        r.holderType === "dependent" && r.holderName
          ? r.holderName
          : r.employee.name;
      const email = ninetyDayReminderEmail({
        employeeName: applicantName,
        lastArrivalDate: fmtDate(r.lastArrivalDate),
        dueDate: fmtDate(r.dueDate),
        offsetDays,
        portalUrl: `${PORTAL_URL}/visa`,
      });

      try {
        await sendEmail({
          to: hrCc.length > 0 ? [r.employee.email, ...hrCc] : r.employee.email,
          ...email,
        });
        await prisma.ninetyDayNotification.update({
          where: { id: r.id },
          data: {
            lastReminderMilestoneDays: milestone,
            lastReminderSentAt: new Date(),
          },
        });
        sent++;
      } catch (err) {
        logger.error("90-day reminder dispatch failed", {
          recordId: r.id,
          error: err instanceof Error ? err.message : err,
        });
        skipped++;
      }
    }

    return { checked: rows.length, sent, skipped };
  }

  // Plain JSON output the FE consumes — dates as YYYY-MM-DD strings
  // (matches existing visa.service shape).
  private serialize(row: {
    id: string;
    employeeId: string;
    entityId: string | null;
    holderType: string;
    holderName: string | null;
    holderRelationship: string | null;
    lastArrivalDate: Date;
    dueDate: Date;
    status: string;
    notes: string | null;
    receiptUrl: string | null;
    receiptName: string | null;
    receiptMimeType: string | null;
    lastReminderMilestoneDays: number | null;
    lastReminderSentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    employee: {
      id: string;
      name: string;
      email: string;
      department: string | null;
    };
    entity?: { id: string; name: string; code: string } | null;
  }) {
    const arrival = row.lastArrivalDate;
    const due = row.dueDate;
    return {
      id: row.id,
      employeeId: row.employeeId,
      entityId: row.entityId,
      entity: row.entity ?? null,
      holderType: row.holderType,
      holderName: row.holderName,
      holderRelationship: row.holderRelationship,
      lastArrivalDate: toDateString(arrival),
      dueDate: toDateString(due),
      notification21Date: toDateString(addDays(due, -21)),
      notification15Date: toDateString(addDays(due, -15)),
      finalReportDate: toDateString(addDays(due, 7)),
      status: row.status,
      notes: row.notes,
      receipt: row.receiptUrl
        ? {
            name: row.receiptName ?? "Receipt",
            url: row.receiptUrl,
            mimeType: row.receiptMimeType,
          }
        : null,
      lastReminderMilestoneDays: row.lastReminderMilestoneDays,
      lastReminderSentAt: row.lastReminderSentAt
        ? row.lastReminderSentAt.toISOString()
        : null,
      employee: row.employee,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const ninetyDayService = new NinetyDayService();

// Internal exports for unit-testing milestone math without touching
// Prisma — keep them out of the public service surface.
export const __internal = { currentMilestone, addDays, daysBetween };
