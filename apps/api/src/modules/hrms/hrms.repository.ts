import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  effectiveVestedToDate,
  isScheduled,
  rollupGrants,
} from "@/modules/hrms/esop-vesting";

const grantIncludes = {
  employee: { select: { id: true, name: true, email: true, department: true } },
} satisfies Prisma.EsopGrantInclude;

const poolGrantSelect = {
  shares: true,
  grantDate: true,
  vestingMonths: true,
  cliffMonths: true,
  allocationStartMonth: true,
  vestedToDateOverride: true,
} satisfies Prisma.EsopGrantSelect;

// Keep legacy active/exercised rows in summaries while the manual status
// picker only offers vesting/vested/cancelled going forward.
const ESOP_SUMMARY_STATUSES = ["active", "vesting", "vested", "exercised"];

export class HrmsRepository {
  // Sheet-aligned pool KPIs: grandTotal / vesting / vested / vestedToDate.
  async getEsopPoolSummary() {
    const grants = await prisma.esopGrant.findMany({
      where: { status: { in: ESOP_SUMMARY_STATUSES } },
      select: poolGrantSelect,
    });
    return rollupGrants(grants, new Date());
  }

  // The same four KPIs scoped to one employee, plus a per-instrument
  // breakdown for the dedicated employee page.
  async getEsopEmployeeSummary(employeeId: string) {
    const [employee, grants] = await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, department: true },
      }),
      prisma.esopGrant.findMany({
        where: { employeeId, status: { in: ESOP_SUMMARY_STATUSES } },
        orderBy: [{ grantDate: "asc" }],
      }),
    ]);
    if (!employee) return null;

    const now = new Date();
    const kpis = rollupGrants(grants, now);
    const instruments = grants.map((g) => ({
      id: g.id,
      grantType: g.grantType,
      scheduled: isScheduled(g),
      shares: g.shares,
      vestedToDate: effectiveVestedToDate(g, now),
      vestedToDateOverride: g.vestedToDateOverride,
      vestingMonths: g.vestingMonths,
      cliffMonths: g.cliffMonths,
      lockMonths: g.lockMonths,
      grantDate: g.grantDate,
      allocationStartMonth: g.allocationStartMonth,
      allocationEndMonth: g.allocationEndMonth,
      currencyCode: g.currencyCode,
      currencyAmount: g.currencyAmount ? Number(g.currencyAmount) : null,
      source: g.source,
      status: g.status,
    }));

    return { employee, kpis, instruments };
  }

  async findGrants(
    filters: {
      status?: string;
      employeeId?: string;
      sortBy?:
        | "employee"
        | "grantType"
        | "usd"
        | "thb"
        | "shares"
        | "lockMonths"
        | "vestingMonths"
        | "cliffMonths"
        | "status";
      sortOrder?: "asc" | "desc";
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.EsopGrantWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;

    // Default ordering keeps the Excel-style grouping: same employee
    // together (by name asc), most recent grant first within the block.
    // When the caller asks for an explicit sort we honour that and fall
    // back to grantDate as a stable tiebreaker.
    const dir = filters.sortOrder ?? "asc";
    const orderBy: Prisma.EsopGrantOrderByWithRelationInput[] =
      filters.sortBy === "employee"
        ? [{ employee: { name: dir } }, { grantDate: "desc" }]
        : filters.sortBy === "grantType"
          ? [{ grantType: dir }, { employee: { name: "asc" } }]
          : filters.sortBy === "shares"
            ? [{ shares: dir }, { employee: { name: "asc" } }]
            : filters.sortBy === "lockMonths"
              ? [{ lockMonths: dir }, { employee: { name: "asc" } }]
              : filters.sortBy === "vestingMonths"
                ? [{ vestingMonths: dir }, { employee: { name: "asc" } }]
                : filters.sortBy === "cliffMonths"
                  ? [{ cliffMonths: dir }, { employee: { name: "asc" } }]
                  : filters.sortBy === "status"
                    ? [{ status: dir }, { employee: { name: "asc" } }]
                    : filters.sortBy === "usd" || filters.sortBy === "thb"
                      ? // USD/THB columns both back onto currencyAmount; the
                        // controller filters out non-matching currencies in
                        // the rendered cell anyway, but here we just want the
                        // numeric order across the page.
                        [{ currencyAmount: dir }, { employee: { name: "asc" } }]
                      : [{ employee: { name: "asc" } }, { grantDate: "desc" }];

    const [data, total] = await Promise.all([
      prisma.esopGrant.findMany({
        where,
        include: grantIncludes,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.esopGrant.count({ where }),
    ]);

    return { data, total };
  }

  async findGrantById(id: string) {
    return prisma.esopGrant.findUnique({
      where: { id },
      include: grantIncludes,
    });
  }

  async createGrant(data: Prisma.EsopGrantUncheckedCreateInput) {
    return prisma.esopGrant.create({
      data,
      include: grantIncludes,
    });
  }

  async updateGrant(id: string, data: Prisma.EsopGrantUpdateInput) {
    return prisma.esopGrant.update({
      where: { id },
      data,
      include: grantIncludes,
    });
  }

  async deleteGrant(id: string) {
    return prisma.esopGrant.delete({ where: { id } });
  }

  async bulkDeleteGrants(ids: string[]) {
    if (ids.length === 0) return { count: 0 };
    return prisma.esopGrant.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteAllGrants() {
    return prisma.esopGrant.deleteMany({});
  }

  async findOnboardingRuns(
    filters: { status?: string; employeeId?: string; deleted?: boolean },
    page: number,
    limit: number,
  ) {
    const where: Prisma.OnboardingRunWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    // Default view excludes soft-deleted runs; the Deleted view shows only them.
    where.deletedAt = filters.deleted ? { not: null } : null;

    const [data, total] = await Promise.all([
      prisma.onboardingRun.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, email: true } },
          entity: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.onboardingRun.count({ where }),
    ]);

    return { data, total };
  }

  // Default lookup excludes soft-deleted runs (so edits/task-toggles on a
  // deleted run 404). Restore MUST use findOnboardingByIdIncludingDeleted.
  async findOnboardingById(id: string) {
    return prisma.onboardingRun.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        entity: { select: { id: true, name: true } },
      },
    });
  }

  async findOnboardingByIdIncludingDeleted(id: string) {
    return prisma.onboardingRun.findUnique({ where: { id } });
  }

  async softDeleteOnboarding(id: string) {
    return prisma.onboardingRun.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restoreOnboarding(id: string) {
    return prisma.onboardingRun.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async createOnboarding(data: Prisma.OnboardingRunUncheckedCreateInput) {
    return prisma.onboardingRun.create({
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        entity: { select: { id: true, name: true } },
      },
    });
  }

  async updateOnboarding(id: string, data: Prisma.OnboardingRunUpdateInput) {
    return prisma.onboardingRun.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        entity: { select: { id: true, name: true } },
      },
    });
  }

  // ── Offboarding (exit checklist) ────────────────────────

  async findOffboardingRuns(
    filters: { status?: string; employeeId?: string; deleted?: boolean },
    page: number,
    limit: number,
  ) {
    const where: Prisma.OffboardingRunWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    where.deletedAt = filters.deleted ? { not: null } : null;

    const [data, total] = await Promise.all([
      prisma.offboardingRun.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, email: true } },
          entity: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.offboardingRun.count({ where }),
    ]);

    return { data, total };
  }

  async findOffboardingById(id: string) {
    return prisma.offboardingRun.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        entity: { select: { id: true, name: true } },
      },
    });
  }

  async findOffboardingByIdIncludingDeleted(id: string) {
    return prisma.offboardingRun.findUnique({ where: { id } });
  }

  async softDeleteOffboarding(id: string) {
    return prisma.offboardingRun.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restoreOffboarding(id: string) {
    return prisma.offboardingRun.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async createOffboarding(data: Prisma.OffboardingRunUncheckedCreateInput) {
    return prisma.offboardingRun.create({
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        entity: { select: { id: true, name: true } },
      },
    });
  }

  async updateOffboarding(id: string, data: Prisma.OffboardingRunUpdateInput) {
    return prisma.offboardingRun.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        entity: { select: { id: true, name: true } },
      },
    });
  }

  // ── Employee agreements ─────────────────────────────────

  async findAgreements(
    filters: { employeeId?: string; type?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.EmployeeAgreementWhereInput = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.type) where.type = filters.type;

    const include = {
      employee: { select: { id: true, name: true, email: true } },
      uploadedBy: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.EmployeeAgreementInclude;

    const [data, total] = await Promise.all([
      prisma.employeeAgreement.findMany({
        where,
        include,
        orderBy: [{ employeeId: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employeeAgreement.count({ where }),
    ]);

    return { data, total };
  }

  async findAgreementById(id: string) {
    return prisma.employeeAgreement.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createAgreement(data: Prisma.EmployeeAgreementUncheckedCreateInput) {
    return prisma.employeeAgreement.create({
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateAgreement(
    id: string,
    data: Prisma.EmployeeAgreementUncheckedUpdateInput,
  ) {
    return prisma.employeeAgreement.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteAgreement(id: string) {
    return prisma.employeeAgreement.delete({ where: { id } });
  }

  /**
   * Per-employee summary for the Agreements folder view: every active
   * employee plus a per-type document count and the most recent update.
   * Employees with zero agreements are kept so HR can start a folder.
   *
   * The aggregate is taken from the same `findMany` the detail view
   * uses (filtered to active users) so the folder card never claims a
   * document the drill-in can't show. The earlier `groupBy` path
   * counted every row in the table — including agreements whose
   * `employeeId` pointed to a deactivated user — which let stale rows
   * inflate the active employee's folder count.
   */
  async findAgreementFolders() {
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: true,
        jobTitle: true,
        employeeId: true,
      },
      orderBy: { name: "asc" },
    });

    const activeIds = employees.map((u) => u.id);
    const agreements = await prisma.employeeAgreement.findMany({
      where: { employeeId: { in: activeIds } },
      select: { employeeId: true, type: true, updatedAt: true },
    });

    const byEmployee = new Map<
      string,
      {
        byType: Record<string, number>;
        total: number;
        lastUpdatedAt: Date | null;
      }
    >();
    for (const a of agreements) {
      const entry = byEmployee.get(a.employeeId) ?? {
        byType: {} as Record<string, number>,
        total: 0,
        lastUpdatedAt: null as Date | null,
      };
      entry.byType[a.type] = (entry.byType[a.type] ?? 0) + 1;
      entry.total += 1;
      if (!entry.lastUpdatedAt || a.updatedAt > entry.lastUpdatedAt) {
        entry.lastUpdatedAt = a.updatedAt;
      }
      byEmployee.set(a.employeeId, entry);
    }

    return employees.map((u) => {
      const stats = byEmployee.get(u.id) ?? {
        byType: {} as Record<string, number>,
        total: 0,
        lastUpdatedAt: null as Date | null,
      };
      return {
        employee: u,
        total: stats.total,
        byType: stats.byType,
        lastUpdatedAt: stats.lastUpdatedAt,
      };
    });
  }

  // ─── Equity Monthly Salary ───────────────────────────────

  async listEquitySalaries(filters: { year?: number }) {
    const where: Prisma.EquityMonthlySalaryWhereInput = {};
    if (filters.year !== undefined) where.year = filters.year;
    return prisma.equityMonthlySalary.findMany({
      where,
      orderBy: [{ year: "desc" }, { employeeName: "asc" }],
    });
  }

  // Replace strategy mirrors ESOP bulk-import: wipe rows for the same
  // year, then bulk-insert. Atomic via $transaction so a partial fail
  // doesn't leave the year half-imported.
  async replaceEquitySalariesForYear(
    year: number,
    rows: Prisma.EquityMonthlySalaryUncheckedCreateInput[],
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.equityMonthlySalary.deleteMany({ where: { year } });
      if (rows.length > 0) {
        await tx.equityMonthlySalary.createMany({ data: rows });
      }
      return rows.length;
    });
  }

  async deleteAllEquitySalaries() {
    const result = await prisma.equityMonthlySalary.deleteMany({});
    return result.count;
  }
}

export const hrmsRepository = new HrmsRepository();
