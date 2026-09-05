import type {
  CreateVisaArticleInput,
  UpdateVisaArticleInput,
  VisaArticleQuery,
} from "@nexora/contracts/modules/visa-kb/visa-kb.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import * as repo from "./visa-kb.repository";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "article"
  );
}

async function uniqueSlug(db: Db, title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let n = 2;
  while (await repo.slugExists(db, candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export async function list(db: Db, query: VisaArticleQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getById(db: Db, id: string) {
  const article = await repo.findById(db, id);
  if (!article) throw new NotFoundException("Article not found");
  return article;
}

export async function getForRecord(db: Db, country?: string, visaType?: string) {
  return repo.findForRecord(db, country, visaType);
}

export async function create(db: Db, input: CreateVisaArticleInput, actorId: string) {
  const slug = await uniqueSlug(db, input.title);
  return repo.create(db, {
    title: input.title,
    slug,
    body: input.body,
    country: input.country || null,
    visaType: input.visaType || null,
    tags: input.tags ?? [],
    isActive: input.isActive ?? true,
    entityId: input.entityId || null,
    createdById: actorId,
  });
}

export async function update(db: Db, id: string, input: UpdateVisaArticleInput) {
  await getById(db, id);
  return repo.update(db, id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.body !== undefined && { body: input.body }),
    ...(input.country !== undefined && { country: input.country || null }),
    ...(input.visaType !== undefined && { visaType: input.visaType || null }),
    ...(input.tags !== undefined && { tags: input.tags }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
    ...(input.entityId !== undefined && { entityId: input.entityId || null }),
  });
}

export async function deactivate(db: Db, id: string) {
  await getById(db, id);
  return repo.update(db, id, { isActive: false });
}
