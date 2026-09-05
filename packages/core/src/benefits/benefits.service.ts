import type { Db } from "@nexora/db";
import type {
  BenefitImportRow,
  CreateBenefitInput,
  EnrollInput,
  ListBenefitsQuery,
  UpdateBenefitInput,
} from "@nexora/contracts/modules/benefits/benefits.validation";
import { ConflictException, NotFoundException } from "../http-exception";
import * as repo from "./benefits.repository";

export async function list(db: Db, query: ListBenefitsQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findAll(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string) {
  const benefit = await repo.findById(db, id);
  if (!benefit) throw new NotFoundException("Benefit not found");
  return benefit;
}

export async function create(db: Db, input: CreateBenefitInput) {
  return repo.create(db, {
    name: input.name,
    category: input.category,
    description: input.description,
    provider: input.provider,
    cost: input.cost,
    currency: input.currency ?? "THB",
    entityId: input.entityId ?? null,
    isActive: input.isActive ?? true,
  });
}

export async function update(db: Db, id: string, input: UpdateBenefitInput) {
  await getById(db, id);
  const { entityId, ...rest } = input;
  return repo.update(db, id, {
    ...rest,
    ...(entityId !== undefined && { entityId }),
  });
}

export async function remove(db: Db, id: string) {
  await getById(db, id);
  await repo.remove(db, id);
}

export async function enroll(db: Db, input: EnrollInput, currentUserId: string) {
  const employeeId = input.employeeId ?? currentUserId;
  const benefit = await getById(db, input.benefitId);
  if (!benefit.isActive) throw new ConflictException("Cannot enroll in an inactive benefit");
  const existing = await repo.findEnrollment(db, input.benefitId, employeeId);
  if (existing && existing.status === "active") {
    throw new ConflictException("Employee is already enrolled in this benefit");
  }
  return repo.enroll(db, { benefitId: input.benefitId, employeeId, startDate: input.startDate });
}

export async function unenroll(db: Db, enrollmentId: string) {
  const enrollment = await repo.findEnrollmentById(db, enrollmentId);
  if (!enrollment) throw new NotFoundException("Enrollment not found");
  return repo.unenroll(db, enrollmentId);
}

export async function getMyEnrollments(db: Db, userId: string) {
  return repo.getEnrollmentsByEmployee(db, userId);
}

type ImportCtx = {
  entityById: Map<string, { id: string; code: string; name: string }>;
  entityByCode: Map<string, { id: string; code: string; name: string }>;
  entityByName: Map<string, { id: string; code: string; name: string }>;
  benefitByKey: Map<string, string>;
};

async function loadImportContext(db: Db): Promise<ImportCtx> {
  const [entities, benefits] = await Promise.all([repo.listEntities(db), repo.listBenefitKeys(db)]);
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const entityByCode = new Map(entities.map((e) => [e.code.toUpperCase(), e]));
  const entityByName = new Map(entities.map((e) => [e.name.toLowerCase(), e]));
  const benefitByKey = new Map<string, string>();
  for (const b of benefits) benefitByKey.set(`${b.name.toLowerCase()}|${b.entityId ?? ""}`, b.id);
  return { entityById, entityByCode, entityByName, benefitByKey };
}

function resolveImportRow(r: BenefitImportRow, i: number, ctx: ImportCtx) {
  const errors: string[] = [];
  let entityId: string | null = null;
  let entityLabel: string | null = null;
  if (r.entityId) {
    const ent = ctx.entityById.get(r.entityId);
    if (ent) {
      entityId = ent.id;
      entityLabel = `${ent.name} (${ent.code})`;
    } else errors.push(`Entity id not found: ${r.entityId}`);
  } else if (r.entityCode) {
    const ent = ctx.entityByCode.get(r.entityCode.toUpperCase());
    if (ent) {
      entityId = ent.id;
      entityLabel = `${ent.name} (${ent.code})`;
    } else errors.push(`Entity code not found: ${r.entityCode}`);
  } else if (r.entityName) {
    const ent = ctx.entityByName.get(r.entityName.toLowerCase());
    if (ent) {
      entityId = ent.id;
      entityLabel = `${ent.name} (${ent.code})`;
    } else errors.push(`Entity name not found: ${r.entityName}`);
  }
  const matched = ctx.benefitByKey.get(`${r.name.toLowerCase()}|${entityId ?? ""}`);
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

export async function previewBenefitImport(db: Db, rows: BenefitImportRow[]) {
  const ctx = await loadImportContext(db);
  const resolved = rows.map((r, i) => resolveImportRow(r, i, ctx));
  return {
    rows: resolved,
    summary: {
      total: resolved.length,
      valid: resolved.filter((r) => r.errors.length === 0).length,
      invalid: resolved.filter((r) => r.errors.length > 0).length,
      inserts: resolved.filter((r) => r.errors.length === 0 && r.action === "insert").length,
      updates: resolved.filter((r) => r.errors.length === 0 && r.action === "update").length,
    },
  };
}

export async function commitBenefitImport(db: Db, rows: BenefitImportRow[]) {
  const ctx = await loadImportContext(db);
  let inserts = 0;
  let updates = 0;
  let skipped = 0;
  const errors: Array<{ row: number; errors: string[] }> = [];
  for (let i = 0; i < rows.length; i++) {
    const resolved = resolveImportRow(rows[i]!, i, ctx);
    if (resolved.errors.length > 0) {
      skipped++;
      errors.push({ row: resolved.row, errors: resolved.errors });
      continue;
    }
    const data = {
      name: resolved.name,
      category: resolved.category,
      description: resolved.description,
      provider: resolved.provider,
      cost: resolved.cost,
      currency: resolved.currency,
      isActive: resolved.isActive,
      entityId: resolved.entityId,
    };
    if (resolved.action === "update" && resolved.matchedBenefitId) {
      await repo.update(db, resolved.matchedBenefitId, data);
      updates++;
    } else {
      await repo.create(db, data);
      inserts++;
    }
  }
  return { inserts, updates, skipped, errors };
}
