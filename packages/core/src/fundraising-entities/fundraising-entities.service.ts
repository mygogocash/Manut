import type {
  CreateFundraisingEntityInput,
  ReorderFundraisingEntitiesInput,
  UpdateFundraisingEntityInput,
} from "@nexora/contracts/modules/fundraising-entities/fundraising-entities.validation";
import { DEFAULT_FUNDRAISING_ENTITY } from "@nexora/contracts/modules/fundraising-entities/fundraising-entities.validation";
import type { Db } from "@nexora/db";
import { BadRequestException, NotFoundException } from "../http-exception";
import { ensureCatalogSeeded } from "../lib/catalog-seed";
import * as repo from "./fundraising-entities.repository";

export const DEFAULT_FUNDRAISING_ENTITIES = [
  { key: "tbh", label: "Manut", sortOrder: 0 },
  { key: "tbl", label: "The Binary Labs", sortOrder: 1 },
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
    () => repo.createManyIfMissing(db, DEFAULT_FUNDRAISING_ENTITIES.map((r) => ({ ...r }))),
  );
}

export async function resolveFundraisingEntityKey(db: Db, key: string | undefined): Promise<string> {
  const resolved = key?.trim() || DEFAULT_FUNDRAISING_ENTITY;
  if (await repo.findByKey(db, resolved)) return resolved;
  const seeded = await ensureSeeded(db);
  if (!seeded.some((e) => e.key === resolved)) {
    throw new BadRequestException("Unknown fundraising entity");
  }
  return resolved;
}

export async function list(db: Db) {
  return ensureSeeded(db);
}

export async function create(db: Db, input: CreateFundraisingEntityInput) {
  const base = slugify(input.label) || "entity";
  let key = base;
  for (let i = 1; ; i++) {
    if (!(await repo.findByKey(db, key))) break;
    key = `${base}_${i}`;
  }
  const sortOrder = (await repo.maxSortOrder(db)) + 1;
  return repo.create(db, { key, label: input.label, sortOrder });
}

export async function update(db: Db, key: string, input: UpdateFundraisingEntityInput) {
  if (!(await repo.findByKey(db, key))) throw new NotFoundException("Entity not found");
  return repo.update(db, key, { label: input.label });
}

export async function remove(db: Db, key: string) {
  const all = await repo.findAll(db);
  const target = all.find((t) => t.key === key);
  if (!target) throw new NotFoundException("Entity not found");
  if (all.length <= 1) throw new BadRequestException("Cannot delete the last fundraising entity.");
  const fallback =
    all.find((t) => t.key === DEFAULT_FUNDRAISING_ENTITY && t.key !== key)?.key ??
    all.find((t) => t.key !== key)!.key;
  await repo.deleteAndReassign(db, key, fallback);
  return { success: true, reassignedTo: fallback };
}

export async function reorder(db: Db, input: ReorderFundraisingEntitiesInput) {
  const all = await repo.findAll(db);
  const known = new Set(all.map((t) => t.key));
  const ordered = input.orderedKeys.filter((k) => known.has(k));
  if (ordered.length === 0) throw new BadRequestException("No valid entity keys to reorder.");
  await repo.applySortOrder(db, ordered);
  return repo.findAll(db);
}
