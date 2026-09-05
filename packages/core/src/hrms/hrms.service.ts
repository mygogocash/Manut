import { PERMISSIONS } from "@nexora/contracts";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception.js";
import {
  ESOP_IMPORT_DEFAULT_STRIKE,
  normaliseEmployeeName,
  type ParsedRow,
} from "./esop-import.js";
import {
  effectiveVestedToDate,
  isScheduled,
  monthsBetweenInclusive,
  type VestingGrant,
} from "./esop-vesting.js";

function toVestingGrant(g: {
  shares: number;
  grantDate: string;
  vestingMonths: number | null;
  cliffMonths: number | null;
  allocationStartMonth?: string | null;
  vestedToDateOverride?: number | null;
}): VestingGrant {
  return {
    shares: g.shares,
    grantDate: new Date(g.grantDate),
    vestingMonths: g.vestingMonths,
    cliffMonths: g.cliffMonths,
    allocationStartMonth: g.allocationStartMonth ? new Date(g.allocationStartMonth) : null,
    vestedToDateOverride: g.vestedToDateOverride,
  };
}
import type { Db } from "@nexora/db";
import { and, eq, like, schema } from "@nexora/db";
import { getSetting, upsertSetting } from "../survey/system-settings.repository.js";
import { parseR2PrivateKey, R2_PRIVATE_PREFIX } from "../certificates/certificates.service.js";
import * as hrmsRepository from "./hrms.repository.js";
import type {
  AgreementQuery,
  CreateAgreementInput,
  CreateEsopGrantInput,
  CreateOffboardingInput,
  CreateOnboardingInput,
  EsopGrantQuery,
  OffboardingQuery,
  OffboardingTemplateInput,
  OnboardingQuery,
  OnboardingTemplateInput,
  ReplaceOffboardingTasksInput,
  ReplaceOnboardingTasksInput,
  SignOffboardingInput,
  UpdateAgreementInput,
  UpdateEsopGrantInput,
  UpdateOffboardingTaskInput,
  UpdateOnboardingTaskInput,
} from "@nexora/contracts/modules/hrms/hrms.validation";

interface OnboardingTask {
  key: string;
  label: string;
  // Free-form HR-defined section ("part"). Distinct values, in task
  // order, drive the grouped checklist.
  part: string;
  done: boolean;
  doneAt?: string;
}

// Admin-managed default onboarding parts + tasks. Lazy default: returned
// when no SystemSetting row exists, so behaviour is unchanged until HR
// saves a custom template.
const ONBOARDING_TEMPLATE_KEY = "onboarding.template";
const DEFAULT_ONBOARDING_TEMPLATE = {
  parts: [
    {
      name: "Onboarding Checklist",
      tasks: [
        "Set up laptop and accounts",
        "Sign NDA and employment agreement",
        "Team introductions",
        "Office tour and seat assignment",
        "Benefits + payroll enrolment",
        "Policy + handbook briefing",
      ],
    },
  ],
};

interface OffboardingTask {
  key: string;
  label: string;
  // Free-form HR-defined section ("part"). Distinct values, in task
  // order, drive the grouped checklist / printable form.
  part: string;
  done: boolean;
  doneAt?: string;
}

// Admin-managed default offboarding parts + tasks. Lazy default: when no
// SystemSetting row exists we return this (the original Company-Assets /
// System-Access checklist), so behaviour is unchanged until HR saves a
// custom template.
const OFFBOARDING_TEMPLATE_KEY = "offboarding.template";
const DEFAULT_OFFBOARDING_TEMPLATE = {
  parts: [
    {
      name: "Exit Process",
      tasks: [
        "Confirm last day",
        "Process final pay",
        "Terminate benefits",
        "Knowledge transfer",
        "Exit interview",
        "Collect company property",
        "Close records",
      ],
    },
    {
      name: "Company Assets (Return)",
      tasks: [
        "Employee Card",
        "Health Insurance Card",
        "Work Permit",
        "Laptop",
        "SOE Laptop, Charger, Token and Laptop Bag",
      ],
    },
    {
      name: "System Access (Deactivate)",
      tasks: ["Email account", "Finger Print", "CCTV"],
    },
  ],
};

// Stable, predictable slug for new task keys. `"Set up VPN"` → `"set-up-vpn"`.
// Falls back to a random suffix when the label slug collapses to empty
// (e.g. all-symbols label like "👋👋"). Keeps the key short — 60 chars
// is plenty since it's never user-facing.
function slugifyTaskKey(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `task-${Math.random().toString(36).slice(2, 8)}`;
}

// Ensure the chosen key doesn't collide with an existing one. We
// append `-2`, `-3`, … to mimic the natural "rename a duplicate"
// behaviour without exposing UUID-style noise.
function uniqueTaskKey(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Prisma Decimal serialises to a string over JSON, which broke the
// front-end (`strikePrice.toFixed is not a function`). Coerce all
// Decimal columns to plain numbers before responding.
type DecimalLike = { toString(): string } | number | null | undefined;
function toNum(v: DecimalLike): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function serializeGrant<T extends Record<string, unknown>>(g: T): T {
  return {
    ...g,
    strikePrice: toNum(g.strikePrice as DecimalLike) ?? 0,
    currencyAmount: toNum(g.currencyAmount as DecimalLike),
    percentOfBase: toNum(g.percentOfBase as DecimalLike),
    monthlyAmount: toNum(g.monthlyAmount as DecimalLike),
  } as T;
}

// A one-time grant's vesting duration is derived from its Start/End dates
// (inclusive months): the dashboard enters Start/End, not a raw month
// count. Start==End — or both blank — yields 0 = granted outright (Vested
// section). Monthly-recurring grants keep their explicit vestingMonths.
function deriveVestingMonths(input: {
  allocationMode?: string;
  allocationStartMonth?: string | null;
  allocationEndMonth?: string | null;
  vestingMonths?: number | null;
}): number | null | undefined {
  if (
    input.allocationMode === "one_time" &&
    input.allocationStartMonth &&
    input.allocationEndMonth
  ) {
    return monthsBetweenInclusive(
      new Date(input.allocationStartMonth),
      new Date(input.allocationEndMonth),
    );
  }
  return input.vestingMonths;
}

function importedGrantStatus(
  vestingMonths: number | null,
): "vesting" | "vested" {
  return (vestingMonths ?? 0) > 0 ? "vesting" : "vested";
}

export async function getEsopPool(db: Db, ) {
    return hrmsRepository.getEsopPoolSummary(db, );
  }

export async function getEsopEmployeeSummary(db: Db, employeeId: string) {
    const summary = await hrmsRepository.getEsopEmployeeSummary(db, employeeId);
    if (!summary) throw new NotFoundException("Employee not found");
    return summary;
  }

export async function listGrants(db: Db,
    query: EsopGrantQuery,
    actorId: string,
    actorPermissions: string[],
  ) {
    const { page, limit, ...filters } = query;
    const canManage = actorPermissions.includes(PERMISSIONS.HRMS_ESOP_MANAGE);
    // Employees only ever see their own grants. HR/admin (esop-manage)
    // can pass any `employeeId` filter or list every grant.
    const scopedFilters = canManage
      ? filters
      : { ...filters, employeeId: actorId };
    const { data, total } = await hrmsRepository.findGrants(db, 
      scopedFilters,
      page,
      limit,
    );
    // vestedToDate is computed server-side (single source of truth with the
    // pool KPI roll-up) so the table column and the cards can never drift.
    const now = new Date();
    return {
      data: data.map((g) =>
        serializeGrant({
          ...g,
          scheduled: isScheduled(g),
          vestedToDate: effectiveVestedToDate(toVestingGrant(g), now),
        }),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

export async function createGrant(db: Db, input: CreateEsopGrantInput) {
    const created = await hrmsRepository.createGrant(db, {
      employeeId: input.employeeId,
      grantDate: input.grantDate,
      grantType: input.grantType,
      valueType: input.valueType,
      shares: input.shares,
      currencyCode: input.currencyCode ?? undefined,
      currencyAmount: input.currencyAmount ?? undefined,
      percentOfBase: input.percentOfBase ?? undefined,
      vestingMonths: deriveVestingMonths(input),
      cliffMonths: input.cliffMonths,
      lockMonths: input.lockMonths,
      strikePrice: String(input.strikePrice),
      allocationMode: input.allocationMode,
      monthlyAmount: input.monthlyAmount ?? undefined,
      allocationStartMonth: input.allocationStartMonth ?? undefined,
      allocationEndMonth: input.allocationEndMonth ?? undefined,
      vestedToDateOverride: input.vestedToDateOverride ?? undefined,
      source: input.source,
      status: input.status,
      notes: input.notes,
    });
    return created ? serializeGrant(created) : null;
  }

export async function updateGrant(db: Db, id: string, input: UpdateEsopGrantInput) {
    const grant = await hrmsRepository.findGrantById(db, id);
    if (!grant) throw new NotFoundException("ESOP grant not found");
    // For a one-time grant the duration is derived from Start/End; this is
    // undefined only when neither dates nor an explicit count were sent, in
    // which case the conditional spread leaves vestingMonths untouched.
    const vestingMonths = deriveVestingMonths(input);
    const updated = await hrmsRepository.updateGrant(db, id, {
        ...(input.grantType !== undefined && { grantType: input.grantType }),
        ...(input.valueType !== undefined && { valueType: input.valueType }),
        ...(input.shares !== undefined && { shares: input.shares }),
        ...(input.currencyCode !== undefined && {
          currencyCode: input.currencyCode,
        }),
        ...(input.currencyAmount !== undefined && {
          currencyAmount: input.currencyAmount,
        }),
        ...(input.percentOfBase !== undefined && {
          percentOfBase: input.percentOfBase,
        }),
        ...(vestingMonths !== undefined && {
          vestingMonths,
        }),
        ...(input.cliffMonths !== undefined && {
          cliffMonths: input.cliffMonths,
        }),
        ...(input.lockMonths !== undefined && { lockMonths: input.lockMonths }),
        ...(input.strikePrice !== undefined && {
          strikePrice: String(input.strikePrice),
        }),
        ...(input.allocationMode !== undefined && {
          allocationMode: input.allocationMode,
        }),
        ...(input.monthlyAmount !== undefined && {
          monthlyAmount: input.monthlyAmount,
        }),
        ...(input.allocationStartMonth !== undefined && {
          allocationStartMonth: input.allocationStartMonth ?? null,
        }),
        ...(input.allocationEndMonth !== undefined && {
          allocationEndMonth: input.allocationEndMonth ?? null,
        }),
        ...(input.vestedToDateOverride !== undefined && {
          vestedToDateOverride: input.vestedToDateOverride,
        }),
        ...(input.source !== undefined && { source: input.source }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.exercisedShares !== undefined && {
          exercisedShares: input.exercisedShares,
        }),
        ...(input.notes !== undefined && { notes: input.notes }),
      });
    return updated ? serializeGrant(updated) : null;
  }

export async function deleteGrant(db: Db, id: string) {
    const grant = await hrmsRepository.findGrantById(db, id);
    if (!grant) throw new NotFoundException("ESOP grant not found");
    return hrmsRepository.deleteGrant(db, id);
  }

export async function bulkDeleteGrants(db: Db, opts: { ids?: string[]; all?: boolean }) {
    if (opts.all === true) {
      const result = await hrmsRepository.deleteAllGrants(db, );
      return { deletedCount: result.count, mode: "all" as const };
    }
    const ids = opts.ids ?? [];
    if (ids.length === 0) {
      throw new BadRequestException(
        "Provide `ids` to delete specific grants or set `all: true`",
      );
    }
    const result = await hrmsRepository.bulkDeleteGrants(db, ids);
    return { deletedCount: result.count, mode: "ids" as const };
  }

  /**
   * Bulk-import ESOP grants from HR's Equity Summary Report template.
   * Each parsed row may yield multiple grants (one per non-empty grant
   * column). Employees are matched case-insensitively against `User.name`.
   *
   * The operation is *additive* — existing grants are not touched. Run
   * this once when seeding from the spreadsheet; subsequent edits should
   * go through the regular create/update endpoints.
   */
export async function bulkImportGrants(db: Db, rows: ParsedRow[], opts: { replace: boolean }) {
  const employees = await db
    .select({ id: schema.users.id, name: schema.users.name, startDate: schema.users.startDate })
    .from(schema.users);
  const byNormalisedName = new Map<
      string,
      { id: string; name: string; startDate: string | null }
    >();
    for (const u of employees) {
      byNormalisedName.set(normaliseEmployeeName(u.name), u);
    }

    const results: {
      rowNumber: number;
      employeeName: string;
      status: "imported" | "skipped" | "failed";
      grantsCreated: number;
      error?: string;
    }[] = [];

    let importedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;
    let totalGrants = 0;

    for (const row of rows) {
      const match = byNormalisedName.get(
        normaliseEmployeeName(row.employeeName),
      );
      if (!match) {
        skippedRows += 1;
        results.push({
          rowNumber: row.rowNumber,
          employeeName: row.employeeName,
          status: "skipped",
          grantsCreated: 0,
          error: "No employee matched by name",
        });
        continue;
      }

      if (row.grants.length === 0) {
        skippedRows += 1;
        results.push({
          rowNumber: row.rowNumber,
          employeeName: row.employeeName,
          status: "skipped",
          grantsCreated: 0,
          error: "Row had no grants to import",
        });
        continue;
      }

      const grantDate = match.startDate ?? new Date().toISOString().slice(0, 10);

      // Defensive de-dupe: collapse identical parsed grants within a
      // single row before insert. Same grantType + sourceColumn + kind
      // + numeric signature → keep one. Protects against accidental
      // template duplication (e.g. two "Sign-up Equity" rows for the
      // same person) without changing legitimate distinct grants.
      const seen = new Set<string>();
      const uniqueGrants = row.grants.filter((g) => {
        const sig =
          g.kind === "shares"
            ? `s:${g.shares}`
            : g.kind === "currency"
              ? `c:${g.currencyCode}:${g.currencyAmount}`
              : `p:${g.percentOfBase}`;
        const key = `${g.grantType}|${g.sourceColumn}|${g.kind}|${sig}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      try {
        if (opts.replace) {
          await db.delete(schema.esopGrants).where(and(eq(schema.esopGrants.employeeId, match.id), like(schema.esopGrants.source, "%Equity Summary Report%")));
        }

        let created = 0;
        for (const g of uniqueGrants) {
          // Empty xlsx cells stay null so HR's spreadsheet → table
          // alignment is exact ("blank in xlsx → blank in UI"). The
          // EsopGrant schema columns are nullable; the UI renders "—"
          // for null. V0 (legacy wide format) doesn't carry these
          // cells either, so its grants land with null too.
          const vestingMonths = g.vestingMonths ?? null;
          const cliffMonths = g.cliffMonths ?? null;
          const lockMonths = g.lockMonths ?? null;
          const status = importedGrantStatus(vestingMonths);

          if (g.kind === "shares") {
            await hrmsRepository.createGrant(db, {
              employeeId: match.id,
              grantDate,
              grantType: g.grantType,
              valueType: "shares",
              shares: g.shares,
              vestingMonths,
              cliffMonths,
              lockMonths,
              allocationStartMonth: g.allocationStartMonth ? (g.allocationStartMonth instanceof Date ? g.allocationStartMonth.toISOString().slice(0, 10) : String(g.allocationStartMonth).slice(0, 10)) : undefined,
              allocationEndMonth: g.allocationEndMonth ? (g.allocationEndMonth instanceof Date ? g.allocationEndMonth.toISOString().slice(0, 10) : String(g.allocationEndMonth).slice(0, 10)) : undefined,
              vestedToDateOverride: g.vestedToDateOverride ?? undefined,
              strikePrice: String(ESOP_IMPORT_DEFAULT_STRIKE),
              allocationMode: "one_time",
              source: `Equity Summary Report — ${g.sourceColumn}`,
              status,
              notes: `Imported value: ${g.rawValue}${g.extraNotes ? `\n${g.extraNotes}` : ""}`,
            });
          } else if (g.kind === "currency") {
            await hrmsRepository.createGrant(db, {
              employeeId: match.id,
              grantDate,
              grantType: g.grantType,
              valueType: "currency",
              shares: 0,
              currencyCode: g.currencyCode,
              currencyAmount: g.currencyAmount != null ? String(g.currencyAmount) : undefined,
              vestingMonths,
              cliffMonths,
              lockMonths,
              allocationStartMonth: g.allocationStartMonth ? (g.allocationStartMonth instanceof Date ? g.allocationStartMonth.toISOString().slice(0, 10) : String(g.allocationStartMonth).slice(0, 10)) : undefined,
              allocationEndMonth: g.allocationEndMonth ? (g.allocationEndMonth instanceof Date ? g.allocationEndMonth.toISOString().slice(0, 10) : String(g.allocationEndMonth).slice(0, 10)) : undefined,
              vestedToDateOverride: g.vestedToDateOverride ?? undefined,
              strikePrice: String(ESOP_IMPORT_DEFAULT_STRIKE),
              allocationMode: "one_time",
              source: `Equity Summary Report — ${g.sourceColumn}`,
              status,
              notes: `Imported value: ${g.rawValue}${g.extraNotes ? `\n${g.extraNotes}` : ""}`,
            });
          } else {
            await hrmsRepository.createGrant(db, {
              employeeId: match.id,
              grantDate,
              grantType: g.grantType,
              valueType: "percent",
              shares: 0,
              percentOfBase: g.percentOfBase != null ? String(g.percentOfBase) : undefined,
              vestingMonths,
              cliffMonths,
              lockMonths,
              allocationStartMonth: g.allocationStartMonth ? (g.allocationStartMonth instanceof Date ? g.allocationStartMonth.toISOString().slice(0, 10) : String(g.allocationStartMonth).slice(0, 10)) : undefined,
              allocationEndMonth: g.allocationEndMonth ? (g.allocationEndMonth instanceof Date ? g.allocationEndMonth.toISOString().slice(0, 10) : String(g.allocationEndMonth).slice(0, 10)) : undefined,
              vestedToDateOverride: g.vestedToDateOverride ?? undefined,
              strikePrice: String(ESOP_IMPORT_DEFAULT_STRIKE),
              allocationMode: "one_time",
              source: `Equity Summary Report — ${g.sourceColumn}`,
              status,
              notes: `Imported value: ${g.rawValue}${g.extraNotes ? `\n${g.extraNotes}` : ""}`,
            });
          }
          created += 1;
        }

        importedRows += 1;
        totalGrants += created;
        results.push({
          rowNumber: row.rowNumber,
          employeeName: row.employeeName,
          status: "imported",
          grantsCreated: created,
        });
      } catch (err) {
        failedRows += 1;
        results.push({
          rowNumber: row.rowNumber,
          employeeName: row.employeeName,
          status: "failed",
          grantsCreated: 0,
          error: err instanceof Error ? err.message : "Unknown failure",
        });
      }
    }

  return {
    importedRows,
    skippedRows,
    failedRows,
    totalGrants,
    results,
  };
}

export async function listOnboarding(db: Db,
    query: OnboardingQuery,
    actorId: string,
    actorPermissions: string[],
  ) {
    const { page, limit, ...filters } = query;
    const canManage = actorPermissions.includes(
      PERMISSIONS.HRMS_ONBOARDING_MANAGE,
    );
    // Employees only see their own onboarding run; HR/admin sees all.
    const scopedFilters = canManage
      ? filters
      : { ...filters, employeeId: actorId };
    const { data, total } = await hrmsRepository.findOnboardingRuns(db, 
      scopedFilters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

export async function createOnboarding(db: Db, input: CreateOnboardingInput) {
    // Cast through `unknown` to keep Prisma's strict `unknown` happy —
    // the parsed Zod array contains `done?: boolean | undefined` whose
    // optional-undefined branch isn't directly assignable to JSON.
    return hrmsRepository.createOnboarding(db, {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      department: input.department,
      startDate: input.startDate,
      entityId: input.entityId,
      tasks: input.tasks as unknown,
    });
  }

export async function updateOnboardingTask(db: Db, id: string, input: UpdateOnboardingTaskInput) {
    const run = await hrmsRepository.findOnboardingById(db, id);
    if (!run) throw new NotFoundException("Onboarding run not found");

    const tasks = (run.tasks ?? []) as unknown as OnboardingTask[];
    const taskIndex = tasks.findIndex((t) => t.key === input.taskKey);
    if (taskIndex === -1) {
      throw new BadRequestException(
        `Task key "${input.taskKey}" not found in this onboarding run`,
      );
    }

    tasks[taskIndex]!.done = input.done;
    tasks[taskIndex]!.doneAt = input.done
      ? new Date().toISOString()
      : undefined;

    const allDone = tasks.every((t) => t.done);
    return hrmsRepository.updateOnboarding(db, id, {
      tasks: tasks as unknown,
      status: allDone ? "completed" : "in_progress",
    });
  }

  /**
   * Replace the entire task array on an onboarding run. HR uses this
   * to rename / add / delete / reorder tasks without coordinating
   * three separate endpoints.
   *
   * - Existing keys are preserved verbatim (their `doneAt` timestamp
   *   sticks). New rows arrive without a key; we slug the label and
   *   append a short suffix to keep the set unique inside the run.
   * - Status is recomputed from the resulting set (allDone vs not).
   */
export async function replaceOnboardingTasks(db: Db, id: string, input: ReplaceOnboardingTasksInput) {
    const run = await hrmsRepository.findOnboardingById(db, id);
    if (!run) throw new NotFoundException("Onboarding run not found");

    const used = new Set<string>();
    const next: OnboardingTask[] = input.tasks.map((t) => {
      const baseKey = t.key?.trim() || slugifyTaskKey(t.label);
      const key = uniqueTaskKey(baseKey, used);
      used.add(key);
      const task: OnboardingTask = {
        key,
        label: t.label.trim(),
        part: t.part.trim(),
        done: t.done,
      };
      if (task.done) {
        task.doneAt = t.doneAt ?? new Date().toISOString();
      }
      return task;
    });

    const allDone = next.every((t) => t.done);
    return hrmsRepository.updateOnboarding(db, id, {
      tasks: next as unknown,
      status: allDone ? "completed" : "in_progress",
    });
  }

  /** Default parts + tasks new onboarding runs start from. */
export async function getOnboardingTemplate(db: Db) {
    const row = await getSetting(db, ONBOARDING_TEMPLATE_KEY);
    if (!row) return DEFAULT_ONBOARDING_TEMPLATE;
    return row as OnboardingTemplateInput;
  }

export async function setOnboardingTemplate(db: Db, input: OnboardingTemplateInput) {
    await upsertSetting(db, ONBOARDING_TEMPLATE_KEY, input);
    return input;
  }

  // Soft delete for duplicate cleanup (HR/admin only — the route gates on
  // HRMS_ONBOARDING_MANAGE). Reversible via restoreOnboarding.
export async function deleteOnboarding(db: Db, id: string) {
    const run = await hrmsRepository.findOnboardingById(db, id);
    if (!run) throw new NotFoundException("Onboarding run not found");
    await hrmsRepository.softDeleteOnboarding(db, id);
    return { success: true };
  }

export async function restoreOnboarding(db: Db, id: string) {
    // Use the include-deleted lookup — findOnboardingById filters deleted rows
    // out, so restore would always 404 through it (the soft-delete IDOR trap).
    const run = await hrmsRepository.findOnboardingByIdIncludingDeleted(db, id);
    if (!run) throw new NotFoundException("Onboarding run not found");
    await hrmsRepository.restoreOnboarding(db, id);
    return { success: true };
  }

  // ── Offboarding (exit checklist) ────────────────────────

export async function listOffboarding(db: Db,
    query: OffboardingQuery,
    actorId: string,
    actorPermissions: string[],
  ) {
    const { page, limit, ...filters } = query;
    const canManage = actorPermissions.includes(
      PERMISSIONS.HRMS_OFFBOARDING_MANAGE,
    );
    // Employees only see their own offboarding run; HR/admin sees all.
    const scopedFilters = canManage
      ? filters
      : { ...filters, employeeId: actorId };
    const { data, total } = await hrmsRepository.findOffboardingRuns(db, 
      scopedFilters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

export async function createOffboarding(db: Db, input: CreateOffboardingInput) {
    return hrmsRepository.createOffboarding(db, {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      position: input.position,
      department: input.department,
      lastWorkingDay: input.lastWorkingDay,
      entityId: input.entityId,
      tasks: input.tasks as unknown,
    });
  }

export async function updateOffboardingTask(db: Db, id: string, input: UpdateOffboardingTaskInput) {
    const run = await hrmsRepository.findOffboardingById(db, id);
    if (!run) throw new NotFoundException("Offboarding run not found");

    const tasks = (run.tasks ?? []) as unknown as OffboardingTask[];
    const taskIndex = tasks.findIndex((t) => t.key === input.taskKey);
    if (taskIndex === -1) {
      throw new BadRequestException(
        `Task key "${input.taskKey}" not found in this offboarding run`,
      );
    }

    tasks[taskIndex]!.done = input.done;
    tasks[taskIndex]!.doneAt = input.done
      ? new Date().toISOString()
      : undefined;

    const allDone = tasks.every((t) => t.done);
    return hrmsRepository.updateOffboarding(db, id, {
      tasks: tasks as unknown,
      status: allDone ? "completed" : "in_progress",
    });
  }

  /**
   * Replace the entire task array on an offboarding run. Mirrors the
   * onboarding bulk-replace: existing keys are preserved, new rows get
   * a slugged + de-duplicated key, and `part` is carried through so the
   * HR-defined grouping survives a rewrite.
   */
export async function replaceOffboardingTasks(db: Db,
    id: string,
    input: ReplaceOffboardingTasksInput,
  ) {
    const run = await hrmsRepository.findOffboardingById(db, id);
    if (!run) throw new NotFoundException("Offboarding run not found");

    const used = new Set<string>();
    const next: OffboardingTask[] = input.tasks.map((t) => {
      const baseKey = t.key?.trim() || slugifyTaskKey(t.label);
      const key = uniqueTaskKey(baseKey, used);
      used.add(key);
      const task: OffboardingTask = {
        key,
        label: t.label.trim(),
        part: t.part.trim(),
        done: t.done,
      };
      if (task.done) {
        task.doneAt = t.doneAt ?? new Date().toISOString();
      }
      return task;
    });

    const allDone = next.every((t) => t.done);
    return hrmsRepository.updateOffboarding(db, id, {
      tasks: next as unknown,
      status: allDone ? "completed" : "in_progress",
    });
  }

  /**
   * Record an employee or HR sign-off on the exit checklist. Stores the
   * signatory's name + a server timestamp; the printable form renders
   * these as the signature lines.
   */
export async function signOffboarding(db: Db, id: string, input: SignOffboardingInput) {
    const run = await hrmsRepository.findOffboardingById(db, id);
    if (!run) throw new NotFoundException("Offboarding run not found");

    const now = new Date().toISOString();
    const data =
      input.party === "employee"
        ? { employeeSignName: input.name, employeeSignedAt: now }
        : { hrSignName: input.name, hrSignedAt: now };
    return hrmsRepository.updateOffboarding(db, id, data);
  }

  // Soft delete for duplicate cleanup (HR/admin only — route gates on
  // HRMS_OFFBOARDING_MANAGE). Reversible via restoreOffboarding.
export async function deleteOffboarding(db: Db, id: string) {
    const run = await hrmsRepository.findOffboardingById(db, id);
    if (!run) throw new NotFoundException("Offboarding run not found");
    await hrmsRepository.softDeleteOffboarding(db, id);
    return { success: true };
  }

export async function restoreOffboarding(db: Db, id: string) {
    const run = await hrmsRepository.findOffboardingByIdIncludingDeleted(db, id);
    if (!run) throw new NotFoundException("Offboarding run not found");
    await hrmsRepository.restoreOffboarding(db, id);
    return { success: true };
  }

  /** Default parts + tasks new offboarding runs start from. */
export async function getOffboardingTemplate(db: Db) {
    const row = await getSetting(db, OFFBOARDING_TEMPLATE_KEY);
    if (!row) return DEFAULT_OFFBOARDING_TEMPLATE;
    return row as OffboardingTemplateInput;
  }

export async function setOffboardingTemplate(db: Db, input: OffboardingTemplateInput) {
    await upsertSetting(db, OFFBOARDING_TEMPLATE_KEY, input);
    return input;
  }

  // ── Employee agreements ─────────────────────────────────

export async function listAgreements(db: Db,
    actorId: string,
    actorPermissions: string[],
    query: AgreementQuery,
  ) {
    const { page, limit, ...filters } = query;
    const canManage = actorPermissions.includes(
      PERMISSIONS.HRMS_AGREEMENTS_MANAGE,
    );

    // Employees only ever see their own row, regardless of any filter
    // they tried to pass. HR/admin must pass an explicit employeeId so
    // the endpoint never falls back to "every agreement in the system"
    // — that path was leaking other employees' documents into folders
    // that should have been empty.
    let employeeId: string;
    if (canManage) {
      if (!filters.employeeId) {
        throw new BadRequestException(
          "employeeId is required when listing agreements",
        );
      }
      employeeId = filters.employeeId;
    } else {
      employeeId = actorId;
    }

    const { data, total } = await hrmsRepository.findAgreements(db, 
      { employeeId, type: filters.type },
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

export async function createAgreement(db: Db, input: CreateAgreementInput, uploadedById: string) {
    const created = await hrmsRepository.createAgreement(db, {
      employeeId: input.employeeId,
      type: input.type,
      title: input.title,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType ?? undefined,
      fileSize: input.fileSize ?? undefined,
      effectiveDate: input.effectiveDate ?? undefined,
      expiryDate: input.expiryDate ?? undefined,
      notes: input.notes ?? undefined,
      uploadedById,
    });


    return created;
  }

export async function updateAgreement(db: Db, id: string, input: UpdateAgreementInput) {
    const existing = await hrmsRepository.findAgreementById(db, id);
    if (!existing) throw new NotFoundException("Agreement not found");

    return hrmsRepository.updateAgreement(db, id, {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
      ...(input.fileName !== undefined && { fileName: input.fileName }),
      ...(input.mimeType !== undefined && { mimeType: input.mimeType }),
      ...(input.fileSize !== undefined && { fileSize: input.fileSize }),
      ...(input.effectiveDate !== undefined && {
        effectiveDate: input.effectiveDate ?? null,
      }),
      ...(input.expiryDate !== undefined && {
        expiryDate: input.expiryDate ?? null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });
  }

export async function deleteAgreement(db: Db, id: string) {
    const existing = await hrmsRepository.findAgreementById(db, id);
    if (!existing) throw new NotFoundException("Agreement not found");
    await hrmsRepository.deleteAgreement(db, id);
    return { id };
  }

export async function getAgreement(db: Db, id: string, actorId: string, actorPermissions: string[]) {
    const agreement = await hrmsRepository.findAgreementById(db, id);
    if (!agreement) throw new NotFoundException("Agreement not found");

    const canManage = actorPermissions.includes(
      PERMISSIONS.HRMS_AGREEMENTS_MANAGE,
    );
    if (!canManage && agreement.employeeId !== actorId) {
      throw new ForbiddenException("You can only view your own agreements");
    }
    return agreement;
  }

export async function getAgreementDownloadUrl(
  db: Db,
  id: string,
  actorId: string,
  actorPermissions: string[],
) {
  const agreement = await getAgreement(db, id, actorId, actorPermissions);
  const r2Key = parseR2PrivateKey(agreement.fileUrl);
  if (r2Key) {
    return { url: `/api/hrms/agreements/${id}/file` };
  }
  if (agreement.fileUrl?.startsWith("http")) {
    return { url: `/api/hrms/agreements/${id}/file` };
  }
  throw new BadRequestException("Agreement file URL is not available");
}

export async function listAgreementFolders(db: Db, ) {
    return hrmsRepository.findAgreementFolders(db, );
  }

  // ─── Equity Monthly Salary ───────────────────────────────

  // Owner-vs-read-all scoping (CLAUDE.md RBAC pattern). `hrms:esop-manage`
  // holders see every row; everyone else (plain `hrms:read`) sees only
  // their own. Match is by normalised name because the model is
  // name-keyed (no FK to User) — HR re-imports the whole sheet and the
  // sheet can include people outside the platform's user table.
export async function listEquitySalaries(db: Db,
    year: number | undefined,
    actorName: string,
    actorPermissions: string[],
  ) {
    const all = await hrmsRepository.listEquitySalaries(db, { year });
    const canManage = actorPermissions.includes(PERMISSIONS.HRMS_ESOP_MANAGE);
    if (canManage) return all;
    const target = normaliseEmployeeName(actorName);
    return all.filter((r) => normaliseEmployeeName(r.employeeName) === target);
  }

export async function importEquitySalaries(db: Db, parsed: {
    year: number;
    rows: Array<{
      employeeName: string;
      position: string | null;
      startDate: string | null;
      currency: string | null;
      monthlyShares: Record<string, number>;
    }>;
  }) {
    const dataRows = parsed.rows.map((r) => ({
      employeeName: r.employeeName,
      position: r.position,
      startDate: r.startDate ?? null,
      currency: r.currency,
      year: parsed.year,
      monthlyShares: r.monthlyShares,
    }));
    const importedRows = await hrmsRepository.replaceEquitySalariesForYear(db, 
      parsed.year,
      dataRows,
    );
    return { year: parsed.year, importedRows };
  }

export async function deleteAllEquitySalaries(db: Db, ) {
    const deletedCount = await hrmsRepository.deleteAllEquitySalaries(db, );
    return { deletedCount };
  }
