import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { ensureCatalogSeeded } from "@/common/utils/lazy-catalog";
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

/**
 * The pipeline board the product ships with. Also written by
 * `20261003000000_investor_pipeline_stages`, whose INSERT only runs where
 * `prisma migrate deploy` runs. On a `db:push`-synced database (staging, and
 * local) the table is created empty, the board renders ZERO columns, and the
 * module looks broken rather than unconfigured. `Investor.status` defaults to
 * `investors`, which is the first key here, so seeding restores coherence
 * between existing rows and the board.
 */
export const DEFAULT_INVESTOR_STAGES = [
  {
    key: "investors",
    label: "Investors",
    color: "border-t-zinc-500",
    sortOrder: 0,
  },
  { key: "lead", label: "Lead", color: "border-t-slate-500", sortOrder: 1 },
  {
    key: "discovery_call",
    label: "Discovery Call / Ongoing Communication",
    color: "border-t-blue-500",
    sortOrder: 2,
  },
  { key: "dd", label: "DD", color: "border-t-violet-500", sortOrder: 3 },
  {
    key: "verbal_commitment",
    label: "Verbal Commitment",
    color: "border-t-amber-500",
    sortOrder: 4,
  },
  {
    key: "agreement_signed",
    label: "Agreement Signed",
    color: "border-t-purple-500",
    sortOrder: 5,
  },
  {
    key: "funds_cleared",
    label: "Funds Cleared",
    color: "border-t-emerald-500",
    sortOrder: 6,
  },
  {
    key: "relationship_management",
    label: "Relationship Management",
    color: "border-t-teal-500",
    sortOrder: 7,
  },
] as const;

async function ensureSeeded() {
  return ensureCatalogSeeded({
    findAll: () => investorPipelineStageRepository.findAll(),
    seed: () =>
      investorPipelineStageRepository.createManyIfMissing(
        DEFAULT_INVESTOR_STAGES.map((r) => ({ ...r })),
      ),
  });
}

export class InvestorPipelineStageService {
  async list() {
    return ensureSeeded();
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
