import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { ensureCatalogSeeded } from "@/common/utils/lazy-catalog";
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

/**
 * The investor categories the product ships with. Also written by
 * `20261004000000_investor_type_options` (+ `20261010000000` adding
 * `introducer` and pushing `other` to 11), whose INSERTs only run where
 * `prisma migrate deploy` runs. On a `db:push`-synced database the table is
 * empty, so the Type picker has no options — and `type` is REQUIRED by
 * `createInvestorSchema`, which makes creating an investor impossible there.
 */
export const DEFAULT_INVESTOR_TYPES = [
  { key: "family_office", label: "Family Office", sortOrder: 0 },
  { key: "private_equity", label: "Private Equity / AM", sortOrder: 1 },
  { key: "venture_capital", label: "Venture Capital", sortOrder: 2 },
  { key: "corporate_vc", label: "Corporate VC", sortOrder: 3 },
  {
    key: "sovereign_wealth_fund",
    label: "Sovereign Wealth Fund",
    sortOrder: 4,
  },
  { key: "corporate_capital", label: "Corporate Capital", sortOrder: 5 },
  { key: "state_capital_soe", label: "State Capital / SOE", sortOrder: 6 },
  { key: "growth_late", label: "Growth / Late Stage", sortOrder: 7 },
  { key: "individual", label: "Individual", sortOrder: 8 },
  { key: "angel", label: "Angel", sortOrder: 9 },
  { key: "introducer", label: "Introducer", sortOrder: 10 },
  { key: "other", label: "Other", sortOrder: 11 },
] as const;

async function ensureSeeded() {
  return ensureCatalogSeeded({
    findAll: () => investorTypeRepository.findAll(),
    seed: () =>
      investorTypeRepository.createManyIfMissing(
        DEFAULT_INVESTOR_TYPES.map((r) => ({ ...r })),
      ),
  });
}

export class InvestorTypeService {
  async list() {
    return ensureSeeded();
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
