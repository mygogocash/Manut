import type { InputJsonValue } from "@manut/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import {
  createSignedUrl,
  requireRegisteredStorageUrl,
  STORAGE_BUCKETS,
} from "@/infrastructure/storage/supabase-storage";
import {
  actorFromId,
  trackAgreementDownloaded,
  trackAgreementUploadedServer,
} from "@/lib/events";
import {
  ESOP_IMPORT_DEFAULT_STRIKE,
  normaliseEmployeeName,
  type ParsedRow,
} from "@/modules/hrms/esop-import";
import {
  effectiveVestedToDate,
  isScheduled,
  monthsBetweenInclusive,
} from "@/modules/hrms/esop-vesting";
import { hrmsRepository } from "@/modules/hrms/hrms.repository";
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
} from "@/modules/hrms/hrms.validation";

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

export class HrmsService {
  async getEsopPool() {
    return hrmsRepository.getEsopPoolSummary();
  }

  async getEsopEmployeeSummary(employeeId: string) {
    const summary = await hrmsRepository.getEsopEmployeeSummary(employeeId);
    if (!summary) throw new NotFoundException("Employee not found");
    return summary;
  }

  async listGrants(
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
    const { data, total } = await hrmsRepository.findGrants(
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
          vestedToDate: effectiveVestedToDate(g, now),
        }),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createGrant(input: CreateEsopGrantInput) {
    const created = await hrmsRepository.createGrant({
      employeeId: input.employeeId,
      grantDate: new Date(input.grantDate),
      grantType: input.grantType,
      valueType: input.valueType,
      shares: input.shares,
      currencyCode: input.currencyCode ?? undefined,
      currencyAmount: input.currencyAmount ?? undefined,
      percentOfBase: input.percentOfBase ?? undefined,
      vestingMonths: deriveVestingMonths(input),
      cliffMonths: input.cliffMonths,
      lockMonths: input.lockMonths,
      strikePrice: input.strikePrice,
      allocationMode: input.allocationMode,
      monthlyAmount: input.monthlyAmount ?? undefined,
      allocationStartMonth: input.allocationStartMonth
        ? new Date(input.allocationStartMonth)
        : undefined,
      allocationEndMonth: input.allocationEndMonth
        ? new Date(input.allocationEndMonth)
        : undefined,
      vestedToDateOverride: input.vestedToDateOverride ?? undefined,
      source: input.source,
      status: input.status,
      notes: input.notes,
    });
    return serializeGrant(created);
  }

  async updateGrant(id: string, input: UpdateEsopGrantInput) {
    const grant = await hrmsRepository.findGrantById(id);
    if (!grant) throw new NotFoundException("ESOP grant not found");
    // For a one-time grant the duration is derived from Start/End; this is
    // undefined only when neither dates nor an explicit count were sent, in
    // which case the conditional spread leaves vestingMonths untouched.
    const vestingMonths = deriveVestingMonths(input);
    return hrmsRepository
      .updateGrant(id, {
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
          strikePrice: input.strikePrice,
        }),
        ...(input.allocationMode !== undefined && {
          allocationMode: input.allocationMode,
        }),
        ...(input.monthlyAmount !== undefined && {
          monthlyAmount: input.monthlyAmount,
        }),
        ...(input.allocationStartMonth !== undefined && {
          allocationStartMonth: input.allocationStartMonth
            ? new Date(input.allocationStartMonth)
            : null,
        }),
        ...(input.allocationEndMonth !== undefined && {
          allocationEndMonth: input.allocationEndMonth
            ? new Date(input.allocationEndMonth)
            : null,
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
      })
      .then(serializeGrant);
  }

  async deleteGrant(id: string) {
    const grant = await hrmsRepository.findGrantById(id);
    if (!grant) throw new NotFoundException("ESOP grant not found");
    return hrmsRepository.deleteGrant(id);
  }

  async bulkDeleteGrants(opts: { ids?: string[]; all?: boolean }) {
    if (opts.all === true) {
      const result = await hrmsRepository.deleteAllGrants();
      return { deletedCount: result.count, mode: "all" as const };
    }
    const ids = opts.ids ?? [];
    if (ids.length === 0) {
      throw new BadRequestException(
        "Provide `ids` to delete specific grants or set `all: true`",
      );
    }
    const result = await hrmsRepository.bulkDeleteGrants(ids);
    return { deletedCount: result.count, mode: "ids" as const };
  }

  /**
   * Bulk-import ESOP grants from the equity-grant import template.
   * Each parsed row may yield multiple grants (one per non-empty grant
   * column). Employees are matched case-insensitively against `User.name`.
   *
   * The operation is *additive* — existing grants are not touched. Run
   * this once when seeding from the spreadsheet; subsequent edits should
   * go through the regular create/update endpoints.
   */
  async bulkImportGrants(rows: ParsedRow[], opts: { replace: boolean }) {
    const employees = await prisma.user.findMany({
      select: { id: true, name: true, startDate: true },
    });
    const byNormalisedName = new Map<
      string,
      { id: string; name: string; startDate: Date | null }
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

      const grantDate = match.startDate ?? new Date();

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
          await prisma.esopGrant.deleteMany({
            where: {
              employeeId: match.id,
              source: { contains: "Equity Summary Report" },
            },
          });
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
            await hrmsRepository.createGrant({
              employeeId: match.id,
              grantDate,
              grantType: g.grantType,
              valueType: "shares",
              shares: g.shares,
              vestingMonths,
              cliffMonths,
              lockMonths,
              allocationStartMonth: g.allocationStartMonth,
              allocationEndMonth: g.allocationEndMonth,
              vestedToDateOverride: g.vestedToDateOverride ?? undefined,
              strikePrice: ESOP_IMPORT_DEFAULT_STRIKE,
              allocationMode: "one_time",
              source: `Equity Summary Report — ${g.sourceColumn}`,
              status,
              notes: `Imported value: ${g.rawValue}${g.extraNotes ? `\n${g.extraNotes}` : ""}`,
            });
          } else if (g.kind === "currency") {
            await hrmsRepository.createGrant({
              employeeId: match.id,
              grantDate,
              grantType: g.grantType,
              valueType: "currency",
              shares: 0,
              currencyCode: g.currencyCode,
              currencyAmount: g.currencyAmount,
              vestingMonths,
              cliffMonths,
              lockMonths,
              allocationStartMonth: g.allocationStartMonth,
              allocationEndMonth: g.allocationEndMonth,
              vestedToDateOverride: g.vestedToDateOverride ?? undefined,
              strikePrice: ESOP_IMPORT_DEFAULT_STRIKE,
              allocationMode: "one_time",
              source: `Equity Summary Report — ${g.sourceColumn}`,
              status,
              notes: `Imported value: ${g.rawValue}${g.extraNotes ? `\n${g.extraNotes}` : ""}`,
            });
          } else {
            await hrmsRepository.createGrant({
              employeeId: match.id,
              grantDate,
              grantType: g.grantType,
              valueType: "percent",
              shares: 0,
              percentOfBase: g.percentOfBase,
              vestingMonths,
              cliffMonths,
              lockMonths,
              allocationStartMonth: g.allocationStartMonth,
              allocationEndMonth: g.allocationEndMonth,
              vestedToDateOverride: g.vestedToDateOverride ?? undefined,
              strikePrice: ESOP_IMPORT_DEFAULT_STRIKE,
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

  async listOnboarding(
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
    const { data, total } = await hrmsRepository.findOnboardingRuns(
      scopedFilters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createOnboarding(input: CreateOnboardingInput) {
    // Cast through `unknown` to keep Prisma's strict `InputJsonValue` happy —
    // the parsed Zod array contains `done?: boolean | undefined` whose
    // optional-undefined branch isn't directly assignable to JSON.
    return hrmsRepository.createOnboarding({
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      department: input.department,
      startDate: new Date(input.startDate),
      entityId: input.entityId,
      tasks: input.tasks as unknown as InputJsonValue,
    });
  }

  async updateOnboardingTask(id: string, input: UpdateOnboardingTaskInput) {
    const run = await hrmsRepository.findOnboardingById(id);
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
    return hrmsRepository.updateOnboarding(id, {
      tasks: tasks as unknown as InputJsonValue,
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
  async replaceOnboardingTasks(id: string, input: ReplaceOnboardingTasksInput) {
    const run = await hrmsRepository.findOnboardingById(id);
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
    return hrmsRepository.updateOnboarding(id, {
      tasks: next as unknown as InputJsonValue,
      status: allDone ? "completed" : "in_progress",
    });
  }

  /** Default parts + tasks new onboarding runs start from. */
  async getOnboardingTemplate() {
    const row = await prisma.systemSetting.findUnique({
      where: { key: ONBOARDING_TEMPLATE_KEY },
    });
    if (!row) return DEFAULT_ONBOARDING_TEMPLATE;
    return row.value as unknown as OnboardingTemplateInput;
  }

  async setOnboardingTemplate(input: OnboardingTemplateInput) {
    await prisma.systemSetting.upsert({
      where: { key: ONBOARDING_TEMPLATE_KEY },
      create: {
        key: ONBOARDING_TEMPLATE_KEY,
        value: input as unknown as InputJsonValue,
      },
      update: { value: input as unknown as InputJsonValue },
    });
    return input;
  }

  // Soft delete for duplicate cleanup (HR/admin only — the route gates on
  // HRMS_ONBOARDING_MANAGE). Reversible via restoreOnboarding.
  async deleteOnboarding(id: string) {
    const run = await hrmsRepository.findOnboardingById(id);
    if (!run) throw new NotFoundException("Onboarding run not found");
    await hrmsRepository.softDeleteOnboarding(id);
    return { success: true };
  }

  async restoreOnboarding(id: string) {
    // Use the include-deleted lookup — findOnboardingById filters deleted rows
    // out, so restore would always 404 through it (the soft-delete IDOR trap).
    const run = await hrmsRepository.findOnboardingByIdIncludingDeleted(id);
    if (!run) throw new NotFoundException("Onboarding run not found");
    await hrmsRepository.restoreOnboarding(id);
    return { success: true };
  }

  // ── Offboarding (exit checklist) ────────────────────────

  async listOffboarding(
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
    const { data, total } = await hrmsRepository.findOffboardingRuns(
      scopedFilters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createOffboarding(input: CreateOffboardingInput) {
    return hrmsRepository.createOffboarding({
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      position: input.position,
      department: input.department,
      lastWorkingDay: new Date(input.lastWorkingDay),
      entityId: input.entityId,
      tasks: input.tasks as unknown as InputJsonValue,
    });
  }

  async updateOffboardingTask(id: string, input: UpdateOffboardingTaskInput) {
    const run = await hrmsRepository.findOffboardingById(id);
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
    return hrmsRepository.updateOffboarding(id, {
      tasks: tasks as unknown as InputJsonValue,
      status: allDone ? "completed" : "in_progress",
    });
  }

  /**
   * Replace the entire task array on an offboarding run. Mirrors the
   * onboarding bulk-replace: existing keys are preserved, new rows get
   * a slugged + de-duplicated key, and `part` is carried through so the
   * HR-defined grouping survives a rewrite.
   */
  async replaceOffboardingTasks(
    id: string,
    input: ReplaceOffboardingTasksInput,
  ) {
    const run = await hrmsRepository.findOffboardingById(id);
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
    return hrmsRepository.updateOffboarding(id, {
      tasks: next as unknown as InputJsonValue,
      status: allDone ? "completed" : "in_progress",
    });
  }

  /**
   * Record an employee or HR sign-off on the exit checklist. Stores the
   * signatory's name + a server timestamp; the printable form renders
   * these as the signature lines.
   */
  async signOffboarding(id: string, input: SignOffboardingInput) {
    const run = await hrmsRepository.findOffboardingById(id);
    if (!run) throw new NotFoundException("Offboarding run not found");

    const now = new Date();
    const data =
      input.party === "employee"
        ? { employeeSignName: input.name, employeeSignedAt: now }
        : { hrSignName: input.name, hrSignedAt: now };
    return hrmsRepository.updateOffboarding(id, data);
  }

  // Soft delete for duplicate cleanup (HR/admin only — route gates on
  // HRMS_OFFBOARDING_MANAGE). Reversible via restoreOffboarding.
  async deleteOffboarding(id: string) {
    const run = await hrmsRepository.findOffboardingById(id);
    if (!run) throw new NotFoundException("Offboarding run not found");
    await hrmsRepository.softDeleteOffboarding(id);
    return { success: true };
  }

  async restoreOffboarding(id: string) {
    const run = await hrmsRepository.findOffboardingByIdIncludingDeleted(id);
    if (!run) throw new NotFoundException("Offboarding run not found");
    await hrmsRepository.restoreOffboarding(id);
    return { success: true };
  }

  /** Default parts + tasks new offboarding runs start from. */
  async getOffboardingTemplate() {
    const row = await prisma.systemSetting.findUnique({
      where: { key: OFFBOARDING_TEMPLATE_KEY },
    });
    if (!row) return DEFAULT_OFFBOARDING_TEMPLATE;
    return row.value as unknown as OffboardingTemplateInput;
  }

  async setOffboardingTemplate(input: OffboardingTemplateInput) {
    await prisma.systemSetting.upsert({
      where: { key: OFFBOARDING_TEMPLATE_KEY },
      create: {
        key: OFFBOARDING_TEMPLATE_KEY,
        value: input as unknown as InputJsonValue,
      },
      update: { value: input as unknown as InputJsonValue },
    });
    return input;
  }

  // ── Employee agreements ─────────────────────────────────

  async listAgreements(
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

    const { data, total } = await hrmsRepository.findAgreements(
      { employeeId, type: filters.type },
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createAgreement(input: CreateAgreementInput, uploadedById: string) {
    await requireRegisteredStorageUrl(input.fileUrl, {
      allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
      purpose: "employee-agreement",
      uploadedBy: uploadedById,
      linkedTo: "employee",
      linkedId: input.employeeId,
    });
    const created = await hrmsRepository.createAgreement({
      employeeId: input.employeeId,
      type: input.type,
      title: input.title,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType ?? undefined,
      fileSize: input.fileSize ?? undefined,
      effectiveDate: input.effectiveDate
        ? new Date(input.effectiveDate)
        : undefined,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      notes: input.notes ?? undefined,
      uploadedById,
    });

    try {
      const trackingActor = await actorFromId(uploadedById);
      if (trackingActor) {
        trackAgreementUploadedServer(trackingActor, {
          agreement_type: input.type,
        });
      }
    } catch {
      // analytics is best-effort
    }

    return created;
  }

  async updateAgreement(
    id: string,
    input: UpdateAgreementInput,
    actorId: string,
  ) {
    const existing = await hrmsRepository.findAgreementById(id);
    if (!existing) throw new NotFoundException("Agreement not found");
    if (input.fileUrl !== undefined) {
      await requireRegisteredStorageUrl(input.fileUrl, {
        allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
        purpose: "employee-agreement",
        uploadedBy: actorId,
        linkedTo: "employee",
        linkedId: existing.employeeId,
      });
    }

    return hrmsRepository.updateAgreement(id, {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
      ...(input.fileName !== undefined && { fileName: input.fileName }),
      ...(input.mimeType !== undefined && { mimeType: input.mimeType }),
      ...(input.fileSize !== undefined && { fileSize: input.fileSize }),
      ...(input.effectiveDate !== undefined && {
        effectiveDate: input.effectiveDate
          ? new Date(input.effectiveDate)
          : null,
      }),
      ...(input.expiryDate !== undefined && {
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });
  }

  async deleteAgreement(id: string) {
    const existing = await hrmsRepository.findAgreementById(id);
    if (!existing) throw new NotFoundException("Agreement not found");
    await hrmsRepository.deleteAgreement(id);
    return { id };
  }

  async getAgreement(id: string, actorId: string, actorPermissions: string[]) {
    const agreement = await hrmsRepository.findAgreementById(id);
    if (!agreement) throw new NotFoundException("Agreement not found");

    const canManage = actorPermissions.includes(
      PERMISSIONS.HRMS_AGREEMENTS_MANAGE,
    );
    if (!canManage && agreement.employeeId !== actorId) {
      throw new ForbiddenException("You can only view your own agreements");
    }
    return agreement;
  }

  // The `documents` bucket is private, so the stored fileUrl returns 404
  // when fetched directly. Mint a short-lived signed URL on demand.
  async getAgreementDownloadUrl(
    id: string,
    actorId: string,
    actorPermissions: string[],
  ) {
    const agreement = await this.getAgreement(id, actorId, actorPermissions);
    const parsed = await requireRegisteredStorageUrl(agreement.fileUrl, {
      allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
      purpose: "employee-agreement",
      linkedTo: "employee",
      linkedId: agreement.employeeId,
    });
    const url = await createSignedUrl(parsed.bucket, parsed.path, 300);

    try {
      const trackingActor = await actorFromId(actorId);
      if (trackingActor) {
        trackAgreementDownloaded(trackingActor, { agreement_id: id });
      }
    } catch {
      // analytics is best-effort
    }

    return { url };
  }

  async listAgreementFolders() {
    return hrmsRepository.findAgreementFolders();
  }

  // ─── Equity Monthly Salary ───────────────────────────────

  // Owner-vs-read-all scoping (CLAUDE.md RBAC pattern). `hrms:esop-manage`
  // holders see every row; everyone else (plain `hrms:read`) sees only
  // their own. Match is by normalised name because the model is
  // name-keyed (no FK to User) — HR re-imports the whole sheet and the
  // sheet can include people outside the platform's user table.
  async listEquitySalaries(
    year: number | undefined,
    actorName: string,
    actorPermissions: string[],
  ) {
    const all = await hrmsRepository.listEquitySalaries({ year });
    const canManage = actorPermissions.includes(PERMISSIONS.HRMS_ESOP_MANAGE);
    if (canManage) return all;
    const target = normaliseEmployeeName(actorName);
    return all.filter((r) => normaliseEmployeeName(r.employeeName) === target);
  }

  async importEquitySalaries(parsed: {
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
      startDate: r.startDate ? new Date(r.startDate) : null,
      currency: r.currency,
      year: parsed.year,
      monthlyShares: r.monthlyShares,
    }));
    const importedRows = await hrmsRepository.replaceEquitySalariesForYear(
      parsed.year,
      dataRows,
    );
    return { year: parsed.year, importedRows };
  }

  async deleteAllEquitySalaries() {
    const deletedCount = await hrmsRepository.deleteAllEquitySalaries();
    return { deletedCount };
  }
}

export const hrmsService = new HrmsService();
