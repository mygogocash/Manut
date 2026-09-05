import type {
  CreateInvestorStageInput,
  ReorderInvestorStagesInput,
  UpdateInvestorStageInput,
} from "@nexora/contracts/modules/investor-pipeline-stages/investor-pipeline-stages.validation";
import type { Db } from "@nexora/db";
import { BadRequestException, NotFoundException } from "../http-exception";
import { ensureCatalogSeeded } from "../lib/catalog-seed";
import * as repo from "./investor-pipeline-stages.repository";

export const DEFAULT_INVESTOR_STAGES = [
  { key: "investors", label: "Investors", color: "border-t-zinc-500", sortOrder: 0 },
  { key: "lead", label: "Lead", color: "border-t-slate-500", sortOrder: 1 },
  { key: "discovery_call", label: "Discovery Call / Ongoing Communication", color: "border-t-blue-500", sortOrder: 2 },
  { key: "dd", label: "DD", color: "border-t-violet-500", sortOrder: 3 },
  { key: "verbal_commitment", label: "Verbal Commitment", color: "border-t-amber-500", sortOrder: 4 },
  { key: "agreement_signed", label: "Agreement Signed", color: "border-t-purple-500", sortOrder: 5 },
  { key: "funds_cleared", label: "Funds Cleared", color: "border-t-emerald-500", sortOrder: 6 },
  { key: "relationship_management", label: "Relationship Management", color: "border-t-teal-500", sortOrder: 7 },
] as const;

function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

async function ensureSeeded(db: Db) {
  return ensureCatalogSeeded(
    () => repo.findAll(db),
    () => repo.createManyIfMissing(db, DEFAULT_INVESTOR_STAGES.map((r) => ({ ...r }))),
  );
}

export async function list(db: Db) {
  return ensureSeeded(db);
}

export async function create(db: Db, input: CreateInvestorStageInput) {
  const base = slugify(input.label) || "stage";
  let key = base;
  for (let i = 1; ; i++) {
    if (!(await repo.findByKey(db, key))) break;
    key = `${base}_${i}`;
  }
  const sortOrder = (await repo.maxSortOrder(db)) + 1;
  return repo.create(db, {
    key,
    label: input.label,
    color: input.color ?? "border-t-zinc-500",
    sortOrder,
  });
}

export async function update(db: Db, key: string, input: UpdateInvestorStageInput) {
  if (!(await repo.findByKey(db, key))) throw new NotFoundException("Stage not found");
  return repo.update(db, key, {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.color !== undefined && { color: input.color }),
  });
}

export async function remove(db: Db, key: string) {
  const all = await repo.findAll(db);
  const target = all.find((s) => s.key === key);
  if (!target) throw new NotFoundException("Stage not found");
  if (all.length <= 1) throw new BadRequestException("Cannot delete the last pipeline stage.");
  const reassignTo = all.find((s) => s.key !== key)!.key;
  await repo.deleteAndReassign(db, key, reassignTo);
  return { success: true, reassignedTo: reassignTo };
}

export async function reorder(db: Db, input: ReorderInvestorStagesInput) {
  const all = await repo.findAll(db);
  const known = new Set(all.map((s) => s.key));
  const ordered = input.orderedKeys.filter((k) => known.has(k));
  if (ordered.length === 0) throw new BadRequestException("No valid stage keys to reorder.");
  await repo.applySortOrder(db, ordered);
  return repo.findAll(db);
}
