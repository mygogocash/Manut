import { PERMISSIONS } from "@nexora/contracts";
import type { Db } from "@nexora/db";
import type {
  CompletionQuery,
  CreateCompletionInput,
  CreateModuleInput,
  ImportModulesInput,
  ModuleQuery,
  UpdateModuleInput,
} from "@nexora/contracts/modules/learning/learning.validation";
import { ConflictException, NotFoundException } from "../http-exception";
import * as repo from "./learning.repository";

export async function listModules(db: Db, query: ModuleQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findModules(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function createModule(db: Db, input: CreateModuleInput) {
  return repo.createModule(db, {
    title: input.title,
    description: input.description,
    category: input.category,
    duration: input.duration,
    url: input.url || undefined,
    fileUrl: input.fileUrl || undefined,
    fileName: input.fileName || undefined,
    isMandatory: input.isMandatory,
    isActive: input.isActive,
  });
}

export async function bulkCreate(db: Db, input: ImportModulesInput) {
  let created = 0;
  let skipped = 0;
  for (const row of input.rows) {
    try {
      await createModule(db, row);
      created++;
    } catch {
      skipped++;
    }
  }
  return { created, skipped };
}

export async function updateModule(db: Db, id: string, input: UpdateModuleInput) {
  const existing = await repo.findModuleById(db, id);
  if (!existing) throw new NotFoundException("Training module not found");
  return repo.updateModule(db, id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.duration !== undefined && { duration: input.duration }),
    ...(input.url !== undefined && { url: input.url || null }),
    ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl || null }),
    ...(input.fileName !== undefined && { fileName: input.fileName || null }),
    ...(input.isMandatory !== undefined && { isMandatory: input.isMandatory }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function listCompletions(
  db: Db,
  userId: string,
  userPermissions: string[],
  query: CompletionQuery,
) {
  const { page, limit, ...filters } = query;
  const hasHrRead = userPermissions.includes(PERMISSIONS.LEARNING_HR_READ);
  if (!hasHrRead) filters.employeeId = userId;
  const { data, total } = await repo.findCompletions(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function markCompleted(db: Db, userId: string, input: CreateCompletionInput) {
  const module = await repo.findModuleById(db, input.moduleId);
  if (!module) throw new NotFoundException("Training module not found");
  const existing = await repo.findCompletion(db, userId, input.moduleId);
  if (existing) throw new ConflictException("Module already completed");
  return repo.createCompletion(db, {
    employeeId: userId,
    moduleId: input.moduleId,
    score: input.score,
  });
}
