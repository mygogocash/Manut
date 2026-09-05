import type {
  CreateInvestorTypeInput,
  ReorderInvestorTypesInput,
  UpdateInvestorTypeInput,
} from "@nexora/contracts/modules/investor-types/investor-types.validation";
import type { Db } from "@nexora/db";
import { BadRequestException, NotFoundException } from "../http-exception";
import { ensureCatalogSeeded } from "../lib/catalog-seed";
import * as repo from "./investor-types.repository";

export const DEFAULT_INVESTOR_TYPES = [
  { key: "family_office", label: "Family Office", sortOrder: 0 },
  { key: "private_equity", label: "Private Equity / AM", sortOrder: 1 },
  { key: "venture_capital", label: "Venture Capital", sortOrder: 2 },
  { key: "corporate_vc", label: "Corporate VC", sortOrder: 3 },
  { key: "sovereign_wealth_fund", label: "Sovereign Wealth Fund", sortOrder: 4 },
  { key: "corporate_capital", label: "Corporate Capital", sortOrder: 5 },
  { key: "state_capital_soe", label: "State Capital / SOE", sortOrder: 6 },
  { key: "growth_late", label: "Growth / Late Stage", sortOrder: 7 },
  { key: "individual", label: "Individual", sortOrder: 8 },
  { key: "angel", label: "Angel", sortOrder: 9 },
  { key: "introducer", label: "Introducer", sortOrder: 10 },
  { key: "other", label: "Other", sortOrder: 11 },
] as const;

function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

async function ensureSeeded(db: Db) {
  return ensureCatalogSeeded(
    () => repo.findAll(db),
    () => repo.createManyIfMissing(db, DEFAULT_INVESTOR_TYPES.map((r) => ({ ...r }))),
  );
}

export async function list(db: Db) {
  return ensureSeeded(db);
}

export async function create(db: Db, input: CreateInvestorTypeInput) {
  const base = slugify(input.label) || "type";
  let key = base;
  for (let i = 1; ; i++) {
    if (!(await repo.findByKey(db, key))) break;
    key = `${base}_${i}`;
  }
  const sortOrder = (await repo.maxSortOrder(db)) + 1;
  return repo.create(db, { key, label: input.label, sortOrder });
}

export async function update(db: Db, key: string, input: UpdateInvestorTypeInput) {
  if (!(await repo.findByKey(db, key))) throw new NotFoundException("Type not found");
  return repo.update(db, key, { label: input.label });
}

export async function remove(db: Db, key: string) {
  const all = await repo.findAll(db);
  const target = all.find((t) => t.key === key);
  if (!target) throw new NotFoundException("Type not found");
  if (all.length <= 1) throw new BadRequestException("Cannot delete the last investor type.");
  const fallback = all.find((t) => t.key === "other" && t.key !== key)?.key ?? all.find((t) => t.key !== key)!.key;
  await repo.deleteAndReassign(db, key, fallback);
  return { success: true, reassignedTo: fallback };
}

export async function reorder(db: Db, input: ReorderInvestorTypesInput) {
  const all = await repo.findAll(db);
  const known = new Set(all.map((t) => t.key));
  const ordered = input.orderedKeys.filter((k) => known.has(k));
  if (ordered.length === 0) throw new BadRequestException("No valid type keys to reorder.");
  await repo.applySortOrder(db, ordered);
  return repo.findAll(db);
}
