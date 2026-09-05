import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../../.env") });

import * as XLSX from "xlsx";

import { PrismaClient } from "../../src/generated/prisma";

// =============================================================================
// One-shot importer: HR's "IT Asset Management Template.xlsx" → assets table.
//
// Scope (sheets that carry real data):
//   Hardware, Software, Laptop, Mouse, Mobile, Usb
//   Demo Sticker / ACC sheets are skipped.
//
// Decisions (confirmed by user):
//   - Status map:  Active → active, OWNER → owner, Available → available,
//                  De-active → retired, Ordered → ordered, default → available.
//   - Office:      split by employee entity (User.entityId → matching Office).
//                  Falls back to the first active office when no user is
//                  attached or the user has no entity.
//   - Duplicates:  serialNo is not unique; rows with the same serialNo across
//                  multiple employees are inserted as historical entries.
//   - Existing:    if a prod Asset already has a serialNo that appears in the
//                  xlsx, the FIRST xlsx row with that serial updates it
//                  in place. Subsequent rows with the same serial insert
//                  fresh.
//   - Email:       `thebinaryholding.com` typo is treated as
//                  `thebinaryholdings.com` for user lookup. Rows whose email /
//                  name don't resolve to a User keep `assignedTo = null` —
//                  HR can wire them up later from the UI.
//
// Run:
//   # Dry run — prints stats + first 10 rows of each sheet, writes nothing.
//   pnpm --filter @nexora/database tsx prisma/scripts/import-it-assets.ts \
//     "/Users/.../IT Asset Management Template.xlsx"
//
//   # Commit — actually writes to the DB the env points at.
//   pnpm --filter @nexora/database tsx prisma/scripts/import-it-assets.ts \
//     "/Users/.../IT Asset Management Template.xlsx" --commit
//
// Idempotency / re-runs:
//   This is a one-off script. It does not de-dup re-runs across invocations.
//   If you run --commit twice, the second run inserts another full copy.
//   Inspect the assets table first if re-running.
// =============================================================================

const prisma = new PrismaClient();

const STATUS_MAP: Record<string, string> = {
  active: "active",
  owner: "owner",
  available: "available",
  "de-active": "retired",
  deactive: "retired",
  retired: "retired",
  ordered: "ordered",
};

const TYPE_LABELS: Record<string, string> = {
  laptop: "Laptop",
  mobile: "Mobile",
  monitor: "Monitor",
  peripheral: "Peripheral",
  usb_accessory: "USB / Accessory",
  software: "Software",
  furniture: "Furniture",
  other: "Other",
};

interface Row {
  type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  colour: string | null;
  subType: string | null;
  serialNo: string | null;
  operatingSystem: string | null;
  status: string;
  description: string | null;
  supportLink: string | null;
  activeServiceDate: Date | null;
  department: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  version: string | null;
  notes: string | null;
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function normaliseEmail(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .trim()
    .toLowerCase()
    .replace(/@thebinaryholding\.com$/, "@thebinaryholdings.com");
}

function normaliseStatus(raw: string | null): string {
  if (!raw) return "available";
  return STATUS_MAP[raw.toLowerCase().trim()] ?? "available";
}

function excelSerialToDate(serial: number | null): Date | null {
  if (!serial || !Number.isFinite(serial)) return null;
  // Excel epoch (Windows): 1899-12-30 baseline.
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asExcelDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return excelSerialToDate(v);
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  if (Number.isFinite(n) && n > 10000) return excelSerialToDate(n);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nameKey(first: string | null, last: string | null): string {
  return `${(first ?? "").trim()} ${(last ?? "").trim()}`
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function parseHardware(rows: unknown[][]): Row[] {
  const out: Row[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const peripheralType = clean(r?.[0]);
    if (!peripheralType) continue;
    out.push({
      type: peripheralType.toLowerCase() === "monitor" ? "monitor" : "peripheral",
      name: clean(r[2]) ?? clean(r[1]) ?? peripheralType,
      manufacturer: clean(r[1]),
      model: clean(r[2]),
      colour: null,
      subType: peripheralType,
      serialNo: clean(r[3]),
      operatingSystem: null,
      status: normaliseStatus(clean(r[4])),
      description: clean(r[5]),
      supportLink: clean(r[6]),
      activeServiceDate: asExcelDate(r[7]),
      department: clean(r[8]),
      email: null,
      firstName: null,
      lastName: null,
      version: null,
      notes: null,
    });
  }
  return out;
}

function parseSoftware(rows: unknown[][]): Row[] {
  const out: Row[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r?.[0]);
    if (!name) continue;
    out.push({
      type: "software",
      name,
      manufacturer: clean(r[1]),
      model: null,
      colour: null,
      subType: clean(r[2]),
      serialNo: null,
      operatingSystem: null,
      status: "active",
      description: null,
      supportLink: null,
      activeServiceDate: null,
      department: null,
      email: null,
      firstName: null,
      lastName: null,
      version: clean(r[3]),
      notes: null,
    });
  }
  return out;
}

function parseLaptop(rows: unknown[][]): Row[] {
  const out: Row[] = [];
  // Header at row 0, qualifier "Employee (Thai)" at row 1, data from row 2.
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const typeCol = clean(r?.[0]);
    if (!typeCol) continue;
    out.push({
      type: "laptop",
      name: clean(r[1]) ?? "Laptop",
      operatingSystem: clean(r[2]),
      manufacturer: clean(r[3]),
      model: clean(r[4]),
      serialNo: clean(r[5]),
      subType: clean(r[6]),
      activeServiceDate: asExcelDate(r[7]),
      status: normaliseStatus(clean(r[8])),
      colour: null,
      description: null,
      supportLink: null,
      firstName: clean(r[10]),
      lastName: clean(r[11]),
      email: clean(r[15]),
      department: clean(r[16]),
      version: null,
      notes: clean(r[17]),
    });
  }
  return out;
}

function parsePeripheralWithEmployee(
  rows: unknown[][],
  type: string,
  headerIdx: number,
): Row[] {
  // Mouse / Mobile use the same header order:
  //   Name, Model, Colour, Serial Number, Active Service Date, Status,
  //   Employee First Name, Employee Last Name, Department.
  const out: Row[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r?.[0]);
    if (!name) continue;
    out.push({
      type,
      name,
      manufacturer: clean(r[0]),
      model: clean(r[1]),
      colour: clean(r[2]),
      subType: null,
      serialNo: clean(r[3]),
      operatingSystem: null,
      activeServiceDate: asExcelDate(r[4]),
      status: normaliseStatus(clean(r[5])),
      description: null,
      supportLink: null,
      firstName: clean(r[6]),
      lastName: clean(r[7]),
      email: null,
      department: clean(r[8]),
      version: null,
      notes: null,
    });
  }
  return out;
}

function parseUsb(rows: unknown[][]): Row[] {
  // Header at row 0:
  //   Name, Model, Colour, Type, Serial Number, Active Service Date, Status,
  //   Employee First Name, Employee Last Name, Department.
  const out: Row[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r?.[0]);
    if (!name) continue;
    out.push({
      type: "usb_accessory",
      name,
      manufacturer: clean(r[0]),
      model: clean(r[1]),
      colour: clean(r[2]),
      subType: clean(r[3]),
      serialNo: clean(r[4]),
      operatingSystem: null,
      activeServiceDate: asExcelDate(r[5]),
      status: normaliseStatus(clean(r[6])),
      description: null,
      supportLink: null,
      firstName: clean(r[7]),
      lastName: clean(r[8]),
      email: null,
      department: clean(r[9]),
      version: null,
      notes: null,
    });
  }
  return out;
}

async function main() {
  const path = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!path) {
    console.error("usage: import-it-assets.ts <xlsx-path> [--commit]");
    process.exit(1);
  }

  const wb = XLSX.readFile(path);
  const sheet = (n: string) =>
    XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, {
      header: 1,
      defval: null,
    });

  const all: Row[] = [
    ...parseHardware(sheet("Hardware")),
    ...parseSoftware(sheet("Software")),
    ...parseLaptop(sheet("Laptop")),
    ...parsePeripheralWithEmployee(sheet("Mouse"), "peripheral", 1),
    ...parsePeripheralWithEmployee(sheet("Mobile"), "mobile", 1),
    ...parseUsb(sheet("Usb")),
  ];

  console.log(`Parsed ${all.length} rows from xlsx.`);

  // Resolve users by email (Laptop) or name (Mouse / Mobile / Usb).
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, entityId: true },
  });
  const userByEmail = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    if (u.email) userByEmail.set(u.email.toLowerCase(), u);
  }
  const userByName = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    if (u.name) userByName.set(u.name.toLowerCase().replace(/\s+/g, " "), u);
  }

  // Office resolution: prefer Office whose country matches the user's entity
  // country; fall back to the first active office.
  const offices = await prisma.office.findMany({
    where: { isActive: true },
    select: { id: true, name: true, country: true },
  });
  const entities = await prisma.entity.findMany({
    select: { id: true, code: true, country: true },
  });
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const officeByCountry = new Map<string, string>();
  for (const o of offices) {
    if (!officeByCountry.has(o.country)) officeByCountry.set(o.country, o.id);
  }
  const fallbackOfficeId = offices[0]?.id ?? null;
  if (!fallbackOfficeId) {
    console.warn(
      "WARN: no active offices found. Dry-run will continue with placeholder; --commit will abort.",
    );
  }

  const resolveUser = (row: Row) => {
    const email = normaliseEmail(row.email);
    if (email) {
      const hit = userByEmail.get(email);
      if (hit) return hit;
    }
    const key = nameKey(row.firstName, row.lastName);
    if (key) {
      const hit = userByName.get(key);
      if (hit) return hit;
    }
    return null;
  };

  const resolveOfficeId = (user: (typeof users)[number] | null): string => {
    if (user?.entityId) {
      const ent = entityById.get(user.entityId);
      if (ent) {
        const officeId = officeByCountry.get(ent.country);
        if (officeId) return officeId;
      }
    }
    return fallbackOfficeId ?? "__missing__";
  };

  // Pre-load existing assets so we know which serialNos already exist for
  // the in-place upsert (first occurrence wins).
  const existing = await prisma.asset.findMany({
    where: { serialNo: { not: null } },
    select: { id: true, serialNo: true },
  });
  const existingBySerial = new Map<string, string>();
  for (const a of existing) {
    if (a.serialNo) existingBySerial.set(a.serialNo.trim(), a.id);
  }

  let inserts = 0;
  let updates = 0;
  let unresolvedAssignee = 0;

  const seenSerials = new Set<string>();
  const samplePerSheet: Record<string, number> = {};

  for (const row of all) {
    const user = resolveUser(row);
    if (!user && (row.email || row.firstName)) unresolvedAssignee++;
    const officeId = resolveOfficeId(user);

    const serial = row.serialNo?.trim() || null;
    const existingId =
      serial && !seenSerials.has(serial) ? existingBySerial.get(serial) : null;
    if (serial) seenSerials.add(serial);

    const data = {
      officeId,
      name: row.name.slice(0, 300),
      type: row.type,
      serialNo: serial,
      assignedTo: user?.id ?? null,
      status: row.status,
      manufacturer: row.manufacturer?.slice(0, 120) ?? null,
      model: row.model?.slice(0, 120) ?? null,
      colour: row.colour?.slice(0, 60) ?? null,
      subType: row.subType?.slice(0, 120) ?? null,
      operatingSystem: row.operatingSystem?.slice(0, 60) ?? null,
      description: row.description?.slice(0, 2000) ?? null,
      supportLink: row.supportLink?.slice(0, 500) ?? null,
      activeServiceDate: row.activeServiceDate,
      department: row.department?.slice(0, 120) ?? null,
      version: row.version?.slice(0, 60) ?? null,
      notes: row.notes?.slice(0, 5000) ?? null,
    };

    samplePerSheet[row.type] = (samplePerSheet[row.type] ?? 0) + 1;

    if (commit) {
      if (!fallbackOfficeId) {
        throw new Error("Cannot --commit: no offices in database.");
      }
      if (existingId) {
        await prisma.asset.update({ where: { id: existingId }, data });
        updates++;
      } else {
        await prisma.asset.create({ data });
        inserts++;
      }
    } else {
      if (existingId) updates++;
      else inserts++;
    }
  }

  console.log("---");
  console.log("Per-type counts:");
  for (const [t, c] of Object.entries(samplePerSheet)) {
    console.log(`  ${TYPE_LABELS[t] ?? t}: ${c}`);
  }
  console.log(
    `Total: ${all.length} rows | inserts=${inserts} updates=${updates} unresolvedAssignee=${unresolvedAssignee}`,
  );
  console.log(commit ? "Committed." : "DRY RUN — no rows written. Pass --commit to apply.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
