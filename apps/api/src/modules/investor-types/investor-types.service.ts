import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { investorTypeRepository } from "@/modules/investor-types/investor-types.repository";
import type {
  CreateInvestorTypeInput,
  ReorderInvestorTypesInput,
  UpdateInvestorTypeInput,
} from "@/modules/investor-types/investor-types.validation";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export class InvestorTypeService {
  async list() {
    return investorTypeRepository.findAll();
  }

  async create(input: CreateInvestorTypeInput) {
    const base = slugify(input.label) || "type";
    let key = base;
    for (let i = 1; ; i++) {
      const existing = await investorTypeRepository.findByKey(key);
      if (!existing) break;
      key = `${base}_${i}`;
    }
    const sortOrder = (await investorTypeRepository.maxSortOrder()) + 1;
    return investorTypeRepository.create({
      key,
      label: input.label,
      sortOrder,
    });
  }

  async update(key: string, input: UpdateInvestorTypeInput) {
    const existing = await investorTypeRepository.findByKey(key);
    if (!existing) throw new NotFoundException("Type not found");
    return investorTypeRepository.update(key, { label: input.label });
  }

  async delete(key: string) {
    const all = await investorTypeRepository.findAll();
    const target = all.find((t) => t.key === key);
    if (!target) throw new NotFoundException("Type not found");
    if (all.length <= 1) {
      throw new BadRequestException("Cannot delete the last investor type.");
    }
    // Reassign investors on this type to "other" if present, else to the
    // first remaining type — so no investor is orphaned on a dead key.
    const fallback =
      all.find((t) => t.key === "other" && t.key !== key)?.key ??
      all.find((t) => t.key !== key)!.key;
    await investorTypeRepository.deleteAndReassign(key, fallback);
    return { success: true, reassignedTo: fallback };
  }

  async reorder(input: ReorderInvestorTypesInput) {
    const all = await investorTypeRepository.findAll();
    const known = new Set(all.map((t) => t.key));
    const ordered = input.orderedKeys.filter((k) => known.has(k));
    if (ordered.length === 0) {
      throw new BadRequestException("No valid type keys to reorder.");
    }
    await investorTypeRepository.applySortOrder(ordered);
    return investorTypeRepository.findAll();
  }
}

export const investorTypeService = new InvestorTypeService();
