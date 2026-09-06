import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { ensureCatalogSeeded } from "@/common/utils/lazy-catalog";
import { fundraisingEntityRepository } from "@/modules/fundraising-entities/fundraising-entities.repository";
import {
  type CreateFundraisingEntityInput,
  DEFAULT_FUNDRAISING_ENTITY,
  type ReorderFundraisingEntitiesInput,
  type UpdateFundraisingEntityInput,
} from "@/modules/fundraising-entities/fundraising-entities.validation";

/**
 * The catalog the product ships with. Also written by
 * `20261123000000_fundraising_entities`, but that INSERT only ever runs where
 * `prisma migrate deploy` runs — i.e. production. Staging syncs with
 * `pnpm db:push:staging` (deploy-staging.yml), which reconciles the SCHEMA and
 * never executes migration SQL, so `fundraising_entities` was created empty
 * there and the entity switcher hid itself (`entities.length === 0` renders
 * null), making the feature look absent. Local databases built with `db:push`
 * have the same hole.
 *
 * Seeding lazily on first read closes it in every environment without an ops
 * step. Deleting an entity is still respected: the backfill only fires when the
 * table is COMPLETELY empty, so a deliberately pruned catalog is never
 * repopulated.
 */
export const DEFAULT_FUNDRAISING_ENTITIES = [
  { key: "tbh", label: "Manut", sortOrder: 0 },
  { key: "tbl", label: "The Binary Labs", sortOrder: 1 },
] as const;

async function ensureSeeded() {
  return ensureCatalogSeeded({
    findAll: () => fundraisingEntityRepository.findAll(),
    seed: () =>
      fundraisingEntityRepository.createManyIfMissing(
        DEFAULT_FUNDRAISING_ENTITIES.map((e) => ({ ...e })),
      ),
  });
}

export async function resolveFundraisingEntityKey(
  key: string | undefined,
): Promise<string> {
  const resolved = key?.trim() || DEFAULT_FUNDRAISING_ENTITY;
  const existing = await fundraisingEntityRepository.findByKey(resolved);
  if (existing) return resolved;
  // An empty catalog is a seeding hole, not a bad request — backfill and retry
  // once before rejecting, or every create on a db:push-built database 400s.
  const seeded = await ensureSeeded();
  if (!seeded.some((e) => e.key === resolved)) {
    throw new BadRequestException("Unknown fundraising entity");
  }
  return resolved;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export class FundraisingEntityService {
  async list() {
    return ensureSeeded();
  }

  async create(input: CreateFundraisingEntityInput) {
    const base = slugify(input.label) || "entity";
    let key = base;
    for (let i = 1; ; i++) {
      const existing = await fundraisingEntityRepository.findByKey(key);
      if (!existing) break;
      key = `${base}_${i}`;
    }
    const sortOrder = (await fundraisingEntityRepository.maxSortOrder()) + 1;
    return fundraisingEntityRepository.create({
      key,
      label: input.label,
      sortOrder,
    });
  }

  async update(key: string, input: UpdateFundraisingEntityInput) {
    const existing = await fundraisingEntityRepository.findByKey(key);
    if (!existing) throw new NotFoundException("Entity not found");
    return fundraisingEntityRepository.update(key, { label: input.label });
  }

  async delete(key: string) {
    const all = await fundraisingEntityRepository.findAll();
    const target = all.find((t) => t.key === key);
    if (!target) throw new NotFoundException("Entity not found");
    if (all.length <= 1) {
      throw new BadRequestException(
        "Cannot delete the last fundraising entity.",
      );
    }
    const fallback =
      all.find((t) => t.key === DEFAULT_FUNDRAISING_ENTITY && t.key !== key)
        ?.key ?? all.find((t) => t.key !== key)!.key;
    await fundraisingEntityRepository.deleteAndReassign(key, fallback);
    return { success: true, reassignedTo: fallback };
  }

  async reorder(input: ReorderFundraisingEntitiesInput) {
    const all = await fundraisingEntityRepository.findAll();
    const known = new Set(all.map((t) => t.key));
    const ordered = input.orderedKeys.filter((k) => known.has(k));
    if (ordered.length === 0) {
      throw new BadRequestException("No valid entity keys to reorder.");
    }
    await fundraisingEntityRepository.applySortOrder(ordered);
    return fundraisingEntityRepository.findAll();
  }
}

export const fundraisingEntityService = new FundraisingEntityService();
