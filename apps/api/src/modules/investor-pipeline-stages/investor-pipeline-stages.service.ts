import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { investorPipelineStageRepository } from "@/modules/investor-pipeline-stages/investor-pipeline-stages.repository";
import type {
  CreateInvestorStageInput,
  ReorderInvestorStagesInput,
  UpdateInvestorStageInput,
} from "@/modules/investor-pipeline-stages/investor-pipeline-stages.validation";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export class InvestorPipelineStageService {
  async list() {
    return investorPipelineStageRepository.findAll();
  }

  async create(input: CreateInvestorStageInput) {
    const base = slugify(input.label) || "stage";
    // Stage keys are the stored status value, so they must be unique;
    // suffix on collision.
    let key = base;
    for (let i = 1; ; i++) {
      const existing = await investorPipelineStageRepository.findByKey(key);
      if (!existing) break;
      key = `${base}_${i}`;
    }
    const sortOrder =
      (await investorPipelineStageRepository.maxSortOrder()) + 1;
    return investorPipelineStageRepository.create({
      key,
      label: input.label,
      color: input.color ?? "border-t-zinc-500",
      sortOrder,
    });
  }

  async update(key: string, input: UpdateInvestorStageInput) {
    const existing = await investorPipelineStageRepository.findByKey(key);
    if (!existing) throw new NotFoundException("Stage not found");
    return investorPipelineStageRepository.update(key, {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.color !== undefined && { color: input.color }),
    });
  }

  async delete(key: string) {
    const all = await investorPipelineStageRepository.findAll();
    const target = all.find((s) => s.key === key);
    if (!target) throw new NotFoundException("Stage not found");
    if (all.length <= 1) {
      throw new BadRequestException("Cannot delete the last pipeline stage.");
    }
    // Reassign any investors on this stage to the first remaining stage
    // (by sort order) so no card is orphaned.
    const reassignTo = all.find((s) => s.key !== key)!.key;
    await investorPipelineStageRepository.deleteAndReassign(key, reassignTo);
    return { success: true, reassignedTo: reassignTo };
  }

  async reorder(input: ReorderInvestorStagesInput) {
    const all = await investorPipelineStageRepository.findAll();
    const known = new Set(all.map((s) => s.key));
    // Only reorder keys that actually exist; ignore stragglers from a
    // stale client payload.
    const ordered = input.orderedKeys.filter((k) => known.has(k));
    if (ordered.length === 0) {
      throw new BadRequestException("No valid stage keys to reorder.");
    }
    await investorPipelineStageRepository.applySortOrder(ordered);
    return investorPipelineStageRepository.findAll();
  }
}

export const investorPipelineStageService = new InvestorPipelineStageService();
