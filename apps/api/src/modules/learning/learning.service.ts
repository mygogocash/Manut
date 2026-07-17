import { PERMISSIONS } from "@/common/constants/permissions";
import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { actorFromId, trackCourseCompletedServer } from "@/lib/events";
import { learningRepository } from "@/modules/learning/learning.repository";
import type {
  CompletionQuery,
  CreateCompletionInput,
  CreateModuleInput,
  ImportModulesInput,
  ModuleQuery,
  UpdateModuleInput,
} from "@/modules/learning/learning.validation";

export class LearningService {
  async listModules(query: ModuleQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await learningRepository.findModules(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createModule(input: CreateModuleInput) {
    return learningRepository.createModule({
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

  // Bulk import from the xlsx / csv dialog. Each row goes through
  // the same `createModule` path so future validations / side-effects
  // stay consistent. Rows that throw (zod failure, db error) are
  // counted under `skipped` rather than failing the whole batch — the
  // L&D team can re-import the deltas once they fix the bad rows.
  async bulkCreate(input: ImportModulesInput) {
    let created = 0;
    let skipped = 0;
    for (const row of input.rows) {
      try {
        await this.createModule(row);
        created++;
      } catch {
        skipped++;
      }
    }
    return { created, skipped };
  }

  async updateModule(id: string, input: UpdateModuleInput) {
    const existing = await learningRepository.findModuleById(id);
    if (!existing) throw new NotFoundException("Training module not found");
    return learningRepository.updateModule(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.duration !== undefined && { duration: input.duration }),
      ...(input.url !== undefined && { url: input.url || null }),
      ...(input.fileUrl !== undefined && {
        fileUrl: input.fileUrl || null,
      }),
      ...(input.fileName !== undefined && {
        fileName: input.fileName || null,
      }),
      ...(input.isMandatory !== undefined && {
        isMandatory: input.isMandatory,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async listCompletions(
    userId: string,
    userPermissions: string[],
    query: CompletionQuery,
  ) {
    const { page, limit, ...filters } = query;
    const hasHrRead = userPermissions.includes(PERMISSIONS.LEARNING_HR_READ);

    if (!hasHrRead) {
      filters.employeeId = userId;
    }

    const { data, total } = await learningRepository.findCompletions(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markCompleted(userId: string, input: CreateCompletionInput) {
    const module = await learningRepository.findModuleById(input.moduleId);
    if (!module) throw new NotFoundException("Training module not found");

    const existing = await learningRepository.findCompletion(
      userId,
      input.moduleId,
    );
    if (existing) throw new ConflictException("Module already completed");

    const created = await learningRepository.createCompletion({
      employeeId: userId,
      moduleId: input.moduleId,
      score: input.score,
    });

    try {
      const trackingActor = await actorFromId(userId);
      if (trackingActor) {
        trackCourseCompletedServer(trackingActor, {
          course_id: input.moduleId,
        });
      }
    } catch {
      // analytics is best-effort
    }

    return created;
  }
}

export const learningService = new LearningService();
