import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateVisaInput,
  ParseScanInput,
  UpdateVisaInput,
  VisaQuery,
} from "@nexora/contracts/modules/visa/visa.validation";
import type { Db } from "@nexora/db";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import { parseR2PrivateKey } from "../certificates/certificates.service";
import { getSetting, upsertSetting } from "../survey/system-settings.repository";
import { visaChecklistService } from "../visa-checklist";
import * as repo from "./visa.repository";

const DEFAULT_REMINDER_MILESTONES_DAYS = [90, 60, 30, 14, 7] as const;
const VISA_RECIPIENTS_KEY = "visa.notification_recipients";
const VISA_LEAD_DAYS_KEY = "visa.notification_lead_days";
const VISA_NOTIFY_EMPLOYEE_KEY = "visa.notify_employee";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VisaRecordRow = NonNullable<Awaited<ReturnType<typeof repo.findById>>>;

function dayIso(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

function buildDiffEvents(
  visaRecordId: string,
  actorId: string | undefined,
  existing: VisaRecordRow,
  input: UpdateVisaInput,
) {
  const events: Parameters<typeof repo.createEventLogs>[1] = [];
  const base = { visaRecordId, actorId: actorId ?? null, actorType: "user" };

  if (input.status !== undefined && input.status !== existing.status) {
    events.push({
      ...base,
      kind: "status_change",
      field: "status",
      oldValue: existing.status,
      newValue: input.status,
    });
  }

  const dateFields: Array<{
    key: "expiryDate" | "issueDate" | "workPermitExpiryDate";
    kind: string;
    current: string | null;
  }> = [
    { key: "expiryDate", kind: "expiry_updated", current: existing.expiryDate },
    { key: "issueDate", kind: "issue_updated", current: existing.issueDate },
    {
      key: "workPermitExpiryDate",
      kind: "work_permit_updated",
      current: existing.workPermitExpiryDate,
    },
  ];
  for (const f of dateFields) {
    const next = input[f.key];
    if (next === undefined) continue;
    const oldIso = dayIso(f.current);
    const newIso = next || null;
    if (oldIso !== newIso) {
      events.push({
        ...base,
        kind: f.kind,
        field: f.key,
        oldValue: oldIso,
        newValue: newIso,
      });
    }
  }

  if (input.notes !== undefined && (input.notes || "") !== (existing.notes || "")) {
    events.push({ ...base, kind: "note_added", field: "notes" });
  }

  if (input.documents !== undefined) {
    const oldLen = Array.isArray(existing.documents) ? existing.documents.length : 0;
    const newLen = Array.isArray(input.documents) ? input.documents.length : 0;
    if (newLen > oldLen) {
      events.push({
        ...base,
        kind: "document_added",
        field: "documents",
        oldValue: String(oldLen),
        newValue: String(newLen),
      });
    }
  }

  return events;
}

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

function pickDate(
  row: Record<string, unknown>,
  ...keys: string[]
): { iso: string; raw: string } | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return { iso: v.toISOString(), raw: v.toISOString().slice(0, 10) };
    }
    const raw = String(v).trim();
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return { iso: d.toISOString(), raw };
    }
    const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const year = yyyy!.length === 2 ? `20${yyyy}` : yyyy;
      const iso = `${year}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) return { iso: parsed.toISOString(), raw };
    }
    return null;
  }
  return null;
}

async function loadVisaNotificationRecipients(db: Db): Promise<string[]> {
  const value = await getSetting(db, VISA_RECIPIENTS_KEY);
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

async function loadVisaNotifyEmployee(db: Db): Promise<boolean> {
  const value = await getSetting(db, VISA_NOTIFY_EMPLOYEE_KEY);
  if (typeof value === "boolean") return value;
  return true;
}

async function loadVisaNotificationLeadDays(db: Db): Promise<number[]> {
  const value = await getSetting(db, VISA_LEAD_DAYS_KEY);
  if (Array.isArray(value)) {
    const cleaned = value
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.floor(n));
    if (cleaned.length === 0) return [...DEFAULT_REMINDER_MILESTONES_DAYS];
    return Array.from(new Set(cleaned)).sort((a, b) => b - a);
  }
  return [...DEFAULT_REMINDER_MILESTONES_DAYS];
}

export async function list(db: Db, userId: string, userPermissions: string[], query: VisaQuery) {
  const { page, limit, ...filters } = query;
  const hasHrRead = userPermissions.includes(PERMISSIONS.VISA_HR_READ);
  if (!hasHrRead) filters.employeeId = userId;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getById(
  db: Db,
  id: string,
  actorId?: string,
  actorPermissions?: string[],
) {
  const record = await repo.findById(db, id);
  if (!record) throw new NotFoundException("Visa record not found");
  if (actorId && actorPermissions) {
    const hasHrRead =
      actorPermissions.includes(PERMISSIONS.VISA_HR_READ) ||
      actorPermissions.includes(PERMISSIONS.VISA_MANAGE);
    if (!hasHrRead && record.employeeId !== actorId) {
      throw new ForbiddenException("You can only view your own visa record");
    }
  }
  return record;
}

function resolveDocumentTarget(
  record: VisaRecordRow,
  docIndex?: number,
): { name: string; url: string; category?: string } {
  const docs = Array.isArray(record.documents)
    ? (record.documents as Array<{ name?: string; url?: string; category?: string }>)
    : [];
  if (typeof docIndex === "number") {
    const item = docs[docIndex];
    if (!item?.url) throw new NotFoundException("Document not found on this record");
    return { name: item.name ?? "document", url: item.url, category: item.category };
  }
  if (record.documentUrl) return { name: "document", url: record.documentUrl };
  throw new NotFoundException("No document attached");
}

export async function assertCanDownloadDocument(
  db: Db,
  id: string,
  actorId: string,
  actorPermissions: string[],
  docIndex?: number,
) {
  const record = await getById(db, id, actorId, actorPermissions);
  const target = resolveDocumentTarget(record, docIndex);
  return { record, target };
}

/** Same-origin Worker stream URL (two-hop like certificates). */
export async function getDocumentDownloadUrl(
  db: Db,
  id: string,
  actorId: string,
  actorPermissions: string[],
  filePath: string,
  docIndex?: number,
) {
  const { target } = await assertCanDownloadDocument(db, id, actorId, actorPermissions, docIndex);
  const r2Key = parseR2PrivateKey(target.url);
  if (!r2Key && !target.url.startsWith("http")) {
    throw new NotFoundException("Document is not available");
  }
  if (!r2Key) return { url: target.url, name: target.name };
  const suffix = typeof docIndex === "number" ? `?docIndex=${docIndex}` : "";
  return { url: `${filePath}${suffix}`, name: target.name };
}

export function documentR2Key(url: string): string | null {
  return parseR2PrivateKey(url);
}

export async function create(db: Db, input: CreateVisaInput, actorId?: string) {
  const isDependent = input.holderType === "dependent";
  const created = await repo.create(db, {
    employeeId: input.employeeId,
    holderType: input.holderType ?? "employee",
    holderName: isDependent ? (input.holderName ?? null) : null,
    holderRelationship: isDependent ? (input.holderRelationship ?? null) : null,
    visaType: input.visaType,
    country: input.country,
    nationality: input.nationality ?? null,
    issueDate: input.issueDate ?? null,
    expiryDate: input.expiryDate,
    workPermitNumber: input.workPermitNumber ?? null,
    workPermitIssueDate: input.workPermitIssueDate ?? null,
    workPermitExpiryDate: input.workPermitExpiryDate ?? null,
    status: input.status,
    documentUrl: input.documentUrl || null,
    documents: input.documents ?? [],
    notes: input.notes ?? null,
    entityId: input.entityId ?? null,
  });
  if (!created) throw new BadRequestException("Failed to create visa record");

  try {
    await repo.createEventLogs(db, [
      {
        visaRecordId: created.id,
        actorId: actorId ?? null,
        actorType: actorId ? "user" : "system",
        kind: "created",
        newValue: input.status ?? "active",
      },
    ]);
  } catch {
    // best-effort timeline
  }

  await visaChecklistService.hydrateChecklist(db, created.id, created.visaType, created.country);
  return created;
}

export async function update(db: Db, id: string, input: UpdateVisaInput, actorId?: string) {
  const existing = await getById(db, id);
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  const updated = await repo.update(db, id, {
    ...(statusChanged && { statusChangedAt: new Date().toISOString() }),
    ...(input.visaType !== undefined && { visaType: input.visaType }),
    ...(input.country !== undefined && { country: input.country }),
    ...(input.nationality !== undefined && { nationality: input.nationality || null }),
    ...(input.issueDate !== undefined && { issueDate: input.issueDate || null }),
    ...(input.expiryDate !== undefined && { expiryDate: input.expiryDate }),
    ...(input.workPermitNumber !== undefined && { workPermitNumber: input.workPermitNumber || null }),
    ...(input.workPermitIssueDate !== undefined && {
      workPermitIssueDate: input.workPermitIssueDate || null,
    }),
    ...(input.workPermitExpiryDate !== undefined && {
      workPermitExpiryDate: input.workPermitExpiryDate || null,
    }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.holderType !== undefined && { holderType: input.holderType }),
    ...(input.holderType === "employee" && { holderName: null, holderRelationship: null }),
    ...(input.holderType === "dependent" &&
      input.holderName !== undefined && { holderName: input.holderName || null }),
    ...(input.holderType === "dependent" &&
      input.holderRelationship !== undefined && {
        holderRelationship: input.holderRelationship || null,
      }),
    ...(input.documentUrl !== undefined && { documentUrl: input.documentUrl || null }),
    ...(input.documents !== undefined && { documents: input.documents }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.entityId !== undefined && { entityId: input.entityId || null }),
  });

  try {
    await repo.createEventLogs(db, buildDiffEvents(id, actorId, existing, input));
  } catch {
    // best-effort timeline
  }

  return updated;
}

export async function getTimeline(db: Db, id: string) {
  await getById(db, id);
  return repo.listEventLogs(db, id);
}

export async function deleteRecord(db: Db, id: string) {
  await getById(db, id);
  return repo.softDelete(db, id);
}

export async function restore(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) {
    const restored = await repo.restore(db, id);
    if (!restored) throw new NotFoundException("Visa record not found");
    return restored;
  }
  throw new ConflictException("Record is not deleted");
}

export async function permanentDelete(db: Db, id: string) {
  await getById(db, id);
  await repo.permanentDelete(db, id);
  return { success: true };
}

export async function parseDocumentScan(_db: Db, _input: ParseScanInput) {
  throw new BadRequestException(
    "Document scan parsing is not available on edge yet. Use the web app or API.",
  );
}

export async function previewImport(db: Db, rows: Array<Record<string, unknown>>) {
  const errors: Array<{ row: number; message: string }> = [];
  const parsed: Array<{
    rowNumber: number;
    employeeIdRaw: string;
    employeeEmail: string;
    employeeName: string;
    employeeCode: string;
    visaType: string;
    country: string;
    expiryDateIso: string;
    issueDateIso: string | null;
    status: string;
    notes: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 1;
    const row = rows[i]!;

    const employeeIdRaw = pickString(row, "employeeId", "employee_id", "Employee ID", "Employee Id");
    const employeeEmail = pickString(row, "employeeEmail", "Email", "email").toLowerCase();
    const employeeName = pickString(row, "employeeName", "Employee Name", "Name", "name");
    const employeeCode =
      employeeIdRaw && !UUID_REGEX.test(employeeIdRaw) ? employeeIdRaw : "";

    if (!employeeIdRaw && !employeeEmail && !employeeName) {
      errors.push({ row: rowNumber, message: "Missing employee — provide ID, email, or full name" });
      continue;
    }

    const visaType = pickString(row, "visaType", "visa_type", "Visa Type");
    if (!visaType) {
      errors.push({ row: rowNumber, message: "Missing visa type" });
      continue;
    }

    const expiry = pickDate(row, "expiryDate", "expiry_date", "Expiry Date");
    if (!expiry) {
      errors.push({ row: rowNumber, message: "Missing or invalid expiry date (use YYYY-MM-DD)" });
      continue;
    }

    const issue = pickDate(row, "issueDate", "issue_date", "Issue Date");
    parsed.push({
      rowNumber,
      employeeIdRaw,
      employeeEmail,
      employeeName,
      employeeCode,
      visaType,
      country: pickString(row, "country", "Country") || "Thailand",
      expiryDateIso: expiry.iso,
      issueDateIso: issue ? issue.iso : null,
      status: pickString(row, "status", "Status").toLowerCase() || "active",
      notes: pickString(row, "notes", "Notes"),
    });
  }

  const valid: Array<(typeof parsed)[number] & { employeeId: string }> = [];
  if (parsed.length > 0) {
    const ids = Array.from(
      new Set(parsed.map((p) => p.employeeIdRaw).filter((v) => v && UUID_REGEX.test(v))),
    );
    const emails = Array.from(new Set(parsed.map((p) => p.employeeEmail).filter(Boolean)));
    const codes = Array.from(new Set(parsed.map((p) => p.employeeCode).filter(Boolean)));
    const needsNameLookup = parsed.some(
      (p) => !p.employeeIdRaw && !p.employeeEmail && !p.employeeCode && p.employeeName,
    );

    const [byId, byEmail, byCode, allActive] = await Promise.all([
      repo.findUsersByIds(db, ids),
      repo.findUsersByEmails(db, emails),
      repo.findUsersByEmployeeCodes(db, codes),
      needsNameLookup ? repo.findActiveUsersForBulkMatch(db) : Promise.resolve([]),
    ]);

    const userById = new Map(byId.map((u) => [u.id, u] as const));
    const userByEmail = new Map(byEmail.map((u) => [u.email.toLowerCase(), u] as const));
    const userByCode = new Map(
      byCode.filter((u) => u.employeeId).map((u) => [u.employeeId as string, u] as const),
    );
    const userByNormalisedName = new Map(allActive.map((u) => [normaliseName(u.name), u] as const));

    for (const p of parsed) {
      let user:
        | { id: string; name: string; email: string; employeeId: string | null }
        | undefined;
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
      visaType: v.visaType,
      country: v.country,
      expiryDate: v.expiryDateIso,
      issueDate: v.issueDateIso,
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
    throw new BadRequestException(
      `${preview.errorCount} rows have errors. Fix them and try again.`,
    );
  }

  let imported = 0;
  const failures: Array<{ row: number; message: string }> = [];

  for (const row of preview.valid) {
    if (!row.employeeId || !UUID_REGEX.test(row.employeeId)) {
      failures.push({
        row: row.rowIndex,
        message: `Row ${row.rowIndex}: resolved employee id is not a valid UUID (${row.employeeId})`,
      });
      continue;
    }
    try {
      await repo.create(db, {
        employeeId: row.employeeId,
        visaType: row.visaType,
        country: row.country,
        expiryDate: row.expiryDate.slice(0, 10),
        issueDate: row.issueDate ? row.issueDate.slice(0, 10) : null,
        status: row.status || "active",
        notes: row.notes || null,
      });
      imported++;
    } catch (err) {
      failures.push({
        row: row.rowIndex,
        message: err instanceof Error ? `Row ${row.rowIndex}: ${err.message}` : `Row ${row.rowIndex}: failed to import`,
      });
    }
  }

  if (failures.length > 0 && imported === 0) {
    throw new BadRequestException(
      `Import failed — ${failures
        .slice(0, 5)
        .map((f) => f.message)
        .join("; ")}${failures.length > 5 ? "; …" : ""}`,
    );
  }

  return {
    imported,
    failed: failures.length,
    failures,
    message:
      failures.length > 0
        ? `${imported} imported, ${failures.length} row(s) failed`
        : `${imported} visa records imported successfully`,
  };
}

export async function getNotificationConfig(db: Db) {
  const [emails, leadDays, notifyEmployee] = await Promise.all([
    loadVisaNotificationRecipients(db),
    loadVisaNotificationLeadDays(db),
    loadVisaNotifyEmployee(db),
  ]);
  return { emails, leadDays, notifyEmployee };
}

export async function setNotificationRecipients(db: Db, rawEmails: string[]) {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of rawEmails) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new BadRequestException(`Invalid email: ${raw}`);
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
  }
  await upsertSetting(db, VISA_RECIPIENTS_KEY, cleaned);
  return { emails: cleaned };
}

export async function setNotificationLeadDays(db: Db, rawDays: unknown[]) {
  const cleaned: number[] = [];
  for (const raw of rawDays) {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n <= 0 || n > 3650) {
      throw new BadRequestException(`Invalid lead day: ${String(raw)}`);
    }
    cleaned.push(n);
  }
  if (cleaned.length === 0) {
    throw new BadRequestException("At least one lead day is required (e.g. [90, 60, 30, 14, 7])");
  }
  const sorted = Array.from(new Set(cleaned)).sort((a, b) => b - a);
  await upsertSetting(db, VISA_LEAD_DAYS_KEY, sorted);
  return { leadDays: sorted };
}

export async function setNotificationNotifyEmployee(db: Db, value: unknown) {
  if (typeof value !== "boolean") {
    throw new BadRequestException("notifyEmployee must be a boolean");
  }
  await upsertSetting(db, VISA_NOTIFY_EMPLOYEE_KEY, value);
  return { notifyEmployee: value };
}
