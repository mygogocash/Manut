import { NINETY_DAY_STATUSES } from "@nexora/contracts/modules/ninety-day/ninety-day.validation";
import type {
  CreateNinetyDayInput,
  NinetyDayQuery,
  UpdateNinetyDayInput,
} from "@nexora/contracts/modules/ninety-day/ninety-day.validation";
import type { Db } from "@nexora/db";
import { BadRequestException, NotFoundException } from "../http-exception";
import * as repo from "./ninety-day.repository";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function pickDate(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const raw = String(v).trim();
    if (!raw) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
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

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function receiptColumns(
  receipt: CreateNinetyDayInput["receipt"] | UpdateNinetyDayInput["receipt"],
):
  | { receiptUrl: string | null; receiptName: string | null; receiptMimeType: string | null }
  | undefined {
  if (receipt === undefined) return undefined;
  if (receipt === null) return { receiptUrl: null, receiptName: null, receiptMimeType: null };
  return { receiptUrl: receipt.url, receiptName: receipt.name, receiptMimeType: receipt.mimeType ?? null };
}

function serialize(row: Awaited<ReturnType<typeof repo.findById>> & object) {
  const due = row.dueDate;
  return {
    id: row.id,
    employeeId: row.employeeId,
    entityId: row.entityId,
    entity: row.entity ?? null,
    holderType: row.holderType,
    holderName: row.holderName,
    holderRelationship: row.holderRelationship,
    lastArrivalDate: row.lastArrivalDate,
    dueDate: due,
    notification21Date: addDays(due, -21),
    notification15Date: addDays(due, -15),
    finalReportDate: addDays(due, 7),
    status: row.status,
    notes: row.notes,
    receipt: row.receiptUrl
      ? { name: row.receiptName ?? "Receipt", url: row.receiptUrl, mimeType: row.receiptMimeType }
      : null,
    lastReminderMilestoneDays: row.lastReminderMilestoneDays,
    lastReminderSentAt: row.lastReminderSentAt,
    employee: row.employee,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function list(db: Db, query: NinetyDayQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return {
    data: data.map((row) => serialize(row)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getById(db: Db, id: string) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("90-day notification not found");
  return serialize(row);
}

export async function create(db: Db, input: CreateNinetyDayInput) {
  const due = addDays(input.lastArrivalDate, 89);
  const created = await repo.create(db, {
    employeeId: input.employeeId,
    entityId: input.entityId || null,
    holderType: input.holderType,
    holderName: input.holderType === "dependent" ? (input.holderName ?? null) : null,
    holderRelationship: input.holderType === "dependent" ? (input.holderRelationship ?? null) : null,
    lastArrivalDate: input.lastArrivalDate,
    dueDate: due,
    status: input.status,
    notes: input.notes ?? null,
    ...(input.receipt !== undefined ? receiptColumns(input.receipt) : {}),
  });
  return serialize(created!);
}

export async function update(db: Db, id: string, input: UpdateNinetyDayInput) {
  await getById(db, id);
  const data: Record<string, unknown> = {};
  if (input.lastArrivalDate !== undefined) {
    data.lastArrivalDate = input.lastArrivalDate;
    data.dueDate = addDays(input.lastArrivalDate, 89);
    data.lastReminderMilestoneDays = null;
    data.lastReminderSentAt = null;
  }
  if (input.entityId !== undefined) data.entityId = input.entityId || null;
  if (input.holderType !== undefined) {
    data.holderType = input.holderType;
    if (input.holderType === "employee") {
      data.holderName = null;
      data.holderRelationship = null;
    }
  }
  if (input.holderName !== undefined) data.holderName = input.holderName;
  if (input.holderRelationship !== undefined) data.holderRelationship = input.holderRelationship;
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;
  const receipt = receiptColumns(input.receipt);
  if (receipt !== undefined) Object.assign(data, receipt);
  const updated = await repo.update(db, id, data as never);
  return serialize(updated!);
}

export async function remove(db: Db, id: string) {
  await getById(db, id);
  await repo.remove(db, id);
  return { success: true };
}

/** Stub: signed URLs not wired on edge yet — returns raw stored URL. */
export async function getReceiptDownloadUrl(db: Db, id: string) {
  const row = await repo.findById(db, id);
  if (!row?.receiptUrl) throw new NotFoundException("No receipt attached to this record");
  return { url: row.receiptUrl, name: row.receiptName ?? "receipt" };
}

export async function previewImport(db: Db, rows: Array<Record<string, unknown>>) {
  const errors: Array<{ row: number; message: string }> = [];
  const parsed: Array<{
    rowNumber: number;
    employeeIdRaw: string;
    employeeEmail: string;
    employeeName: string;
    employeeCode: string;
    lastArrivalDate: string;
    status: (typeof NINETY_DAY_STATUSES)[number];
    notes: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 1;
    const row = rows[i]!;
    const employeeIdRaw = pickString(row, "employeeId", "employee_id", "Employee ID", "Employee Id");
    const employeeEmail = pickString(row, "employeeEmail", "Email", "email").toLowerCase();
    const employeeName = pickString(row, "employeeName", "Employee Name", "Name", "name");
    const employeeCode = employeeIdRaw && !UUID_REGEX.test(employeeIdRaw) ? employeeIdRaw : "";
    if (!employeeIdRaw && !employeeEmail && !employeeName) {
      errors.push({ row: rowNumber, message: "Missing employee — provide ID, email, or full name" });
      continue;
    }
    const arrival = pickDate(row, "lastArrivalDate", "last_arrival_date", "Last Arrival Date", "Arrival Date", "arrivalDate");
    if (!arrival) {
      errors.push({ row: rowNumber, message: "Missing or invalid last arrival date (use YYYY-MM-DD)" });
      continue;
    }
    const statusRaw = pickString(row, "status", "Status").toLowerCase() || "pending";
    const status = (NINETY_DAY_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as (typeof NINETY_DAY_STATUSES)[number])
      : "pending";
    parsed.push({
      rowNumber,
      employeeIdRaw,
      employeeEmail,
      employeeName,
      employeeCode,
      lastArrivalDate: arrival,
      status,
      notes: pickString(row, "notes", "Notes"),
    });
  }

  const valid: Array<(typeof parsed)[number] & { employeeId: string }> = [];
  if (parsed.length > 0) {
    const ids = Array.from(new Set(parsed.map((p) => p.employeeIdRaw).filter((v) => v && UUID_REGEX.test(v))));
    const emails = Array.from(new Set(parsed.map((p) => p.employeeEmail).filter(Boolean)));
    const codes = Array.from(new Set(parsed.map((p) => p.employeeCode).filter(Boolean)));
    const needsNameLookup = parsed.some((p) => !p.employeeIdRaw && !p.employeeEmail && !p.employeeCode && p.employeeName);

    const [byId, byEmail, byCode, allActive] = await Promise.all([
      repo.findUsersByIds(db, ids),
      repo.findUsersByEmails(db, emails),
      repo.findUsersByEmployeeCodes(db, codes),
      needsNameLookup ? repo.findActiveUsersForBulkMatch(db) : Promise.resolve([]),
    ]);

    const userById = new Map(byId.map((u) => [u.id, u] as const));
    const userByEmail = new Map(byEmail.map((u) => [u.email.toLowerCase(), u] as const));
    const userByCode = new Map(byCode.filter((u) => u.employeeId).map((u) => [u.employeeId as string, u] as const));
    const userByNormalisedName = new Map(allActive.map((u) => [normaliseName(u.name), u] as const));

    for (const p of parsed) {
      let user = undefined as (typeof byId)[number] | undefined;
      if (p.employeeIdRaw && UUID_REGEX.test(p.employeeIdRaw)) user = userById.get(p.employeeIdRaw);
      if (!user && p.employeeCode) user = userByCode.get(p.employeeCode);
      if (!user && p.employeeEmail) user = userByEmail.get(p.employeeEmail);
      if (!user && p.employeeName) user = userByNormalisedName.get(normaliseName(p.employeeName));
      if (!user) {
        errors.push({
          row: p.rowNumber,
          message: `Could not match employee — ${p.employeeIdRaw || p.employeeEmail || p.employeeName || "(blank)"}`,
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

export async function commitImport(db: Db, rows: Array<Record<string, unknown>>) {
  const preview = await previewImport(db, rows);
  if (preview.errorCount > 0) {
    throw new BadRequestException(`${preview.errorCount} rows have errors. Fix them and try again.`);
  }
  let imported = 0;
  for (const row of preview.valid) {
    const due = addDays(row.lastArrivalDate, 89);
    await repo.create(db, {
      employeeId: row.employeeId,
      lastArrivalDate: row.lastArrivalDate,
      dueDate: due,
      status: row.status,
      notes: row.notes || null,
      holderType: "employee",
    });
    imported++;
  }
  return { imported };
}
