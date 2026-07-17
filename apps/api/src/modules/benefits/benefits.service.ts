import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { actorFromId, trackBenefitEnrolledServer } from "@/lib/events";
import { benefitsRepository } from "@/modules/benefits/benefits.repository";
import type {
  BenefitImportRow,
  CreateBenefitInput,
  EnrollInput,
  ListBenefitsQuery,
  UpdateBenefitInput,
} from "@/modules/benefits/benefits.validation";

export class BenefitsService {
  async list(query: ListBenefitsQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await benefitsRepository.findAll(
      filters,
      page,
      limit,
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const benefit = await benefitsRepository.findById(id);
    if (!benefit) throw new NotFoundException("Benefit not found");
    return benefit;
  }

  async create(input: CreateBenefitInput) {
    return benefitsRepository.create({
      name: input.name,
      category: input.category,
      description: input.description,
      provider: input.provider,
      cost: input.cost,
      currency: input.currency ?? "THB",
      isActive: input.isActive ?? true,
      ...(input.entityId && { entity: { connect: { id: input.entityId } } }),
    });
  }

  async update(id: string, input: UpdateBenefitInput) {
    await this.getById(id);
    // Strip the scalar `entityId` before forwarding to Prisma —
    // `Prisma.BenefitUpdateInput` (the checked variant) only accepts
    // the `entity` relation operator. Leaving both in causes Prisma to
    // throw "Unknown arg `entityId`" at runtime, which surfaces as a
    // generic 500 on the edit dialog.
    const { entityId, ...rest } = input;
    return benefitsRepository.update(id, {
      ...rest,
      ...(entityId !== undefined && {
        entity: entityId ? { connect: { id: entityId } } : { disconnect: true },
      }),
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return benefitsRepository.delete(id);
  }

  async enroll(input: EnrollInput, currentUserId: string) {
    const employeeId = input.employeeId ?? currentUserId;
    const benefit = await this.getById(input.benefitId);

    if (!benefit.isActive) {
      throw new ConflictException("Cannot enroll in an inactive benefit");
    }

    const existing = await benefitsRepository.findEnrollment(
      input.benefitId,
      employeeId,
    );
    if (existing && existing.status === "active") {
      throw new ConflictException(
        "Employee is already enrolled in this benefit",
      );
    }

    const created = await benefitsRepository.enroll({
      benefitId: input.benefitId,
      employeeId,
      startDate: new Date(input.startDate),
    });

    try {
      const trackingActor = await actorFromId(currentUserId);
      if (trackingActor) {
        trackBenefitEnrolledServer(trackingActor, {
          benefit_id: input.benefitId,
        });
      }
    } catch {
      // analytics is best-effort
    }

    return created;
  }

  async unenroll(enrollmentId: string) {
    const enrollment =
      await benefitsRepository.findEnrollmentById(enrollmentId);
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    return benefitsRepository.unenroll(enrollmentId);
  }

  async getMyEnrollments(userId: string) {
    return benefitsRepository.getEnrollmentsByEmployee(userId);
  }

  // ─── Bulk import ──────────────────────────────────────

  async previewBenefitImport(rows: BenefitImportRow[]) {
    const ctx = await this.loadBenefitImportContext();
    const resolved = rows.map((r, i) =>
      this.resolveBenefitImportRow(r, i, ctx),
    );
    const summary = {
      total: resolved.length,
      valid: resolved.filter((r) => r.errors.length === 0).length,
      invalid: resolved.filter((r) => r.errors.length > 0).length,
      inserts: resolved.filter(
        (r) => r.errors.length === 0 && r.action === "insert",
      ).length,
      updates: resolved.filter(
        (r) => r.errors.length === 0 && r.action === "update",
      ).length,
    };
    return { rows: resolved, summary };
  }

  async commitBenefitImport(rows: BenefitImportRow[]) {
    const ctx = await this.loadBenefitImportContext();
    let inserts = 0;
    let updates = 0;
    let skipped = 0;
    const errors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const resolved = this.resolveBenefitImportRow(r, i, ctx);
      if (resolved.errors.length > 0) {
        skipped++;
        errors.push({ row: resolved.row, errors: resolved.errors });
        continue;
      }

      const data = {
        name: resolved.name,
        category: resolved.category,
        description: resolved.description ?? null,
        provider: resolved.provider ?? null,
        cost: resolved.cost,
        currency: resolved.currency,
        isActive: resolved.isActive,
        ...(resolved.entityId && {
          entity: { connect: { id: resolved.entityId } },
        }),
      };

      if (resolved.action === "update" && resolved.matchedBenefitId) {
        await benefitsRepository.update(resolved.matchedBenefitId, data);
        updates++;
      } else {
        await benefitsRepository.create(data);
        inserts++;
      }
    }

    return { inserts, updates, skipped, errors };
  }

  private async loadBenefitImportContext() {
    const [entities, benefits] = await Promise.all([
      prisma.entity.findMany({
        select: { id: true, code: true, name: true },
      }),
      prisma.benefit.findMany({
        select: { id: true, name: true, entityId: true },
      }),
    ]);

    const entityById = new Map(entities.map((e) => [e.id, e]));
    const entityByCode = new Map(
      entities.map((e) => [e.code.toUpperCase(), e]),
    );
    const entityByName = new Map(
      entities.map((e) => [e.name.toLowerCase(), e]),
    );
    const benefitByKey = new Map<string, string>();
    for (const b of benefits) {
      benefitByKey.set(`${b.name.toLowerCase()}|${b.entityId ?? ""}`, b.id);
    }

    return { entityById, entityByCode, entityByName, benefitByKey };
  }

  private resolveBenefitImportRow(
    r: BenefitImportRow,
    i: number,
    ctx: Awaited<ReturnType<BenefitsService["loadBenefitImportContext"]>>,
  ) {
    const errors: string[] = [];

    let entityId: string | null = null;
    let entityLabel: string | null = null;
    if (r.entityId) {
      const ent = ctx.entityById.get(r.entityId);
      if (ent) {
        entityId = ent.id;
        entityLabel = `${ent.name} (${ent.code})`;
      } else {
        errors.push(`Entity id not found: ${r.entityId}`);
      }
    } else if (r.entityCode) {
      const ent = ctx.entityByCode.get(r.entityCode.toUpperCase());
      if (ent) {
        entityId = ent.id;
        entityLabel = `${ent.name} (${ent.code})`;
      } else {
        errors.push(`Entity code not found: ${r.entityCode}`);
      }
    } else if (r.entityName) {
      const ent = ctx.entityByName.get(r.entityName.toLowerCase());
      if (ent) {
        entityId = ent.id;
        entityLabel = `${ent.name} (${ent.code})`;
      } else {
        errors.push(`Entity name not found: ${r.entityName}`);
      }
    }

    const matched = ctx.benefitByKey.get(
      `${r.name.toLowerCase()}|${entityId ?? ""}`,
    );

    return {
      row: i + 1,
      name: r.name,
      category: r.category,
      description: r.description ?? null,
      provider: r.provider ?? null,
      cost: r.cost,
      currency: r.currency ?? "THB",
      isActive: r.isActive ?? true,
      entityId,
      entityLabel,
      action: matched ? ("update" as const) : ("insert" as const),
      matchedBenefitId: matched ?? null,
      errors,
    };
  }
}

export const benefitsService = new BenefitsService();
