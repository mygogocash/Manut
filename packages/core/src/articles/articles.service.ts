import type { Db } from "@nexora/db";
import type {
  CreateArticleInput,
  UpdateArticleInput,
} from "@nexora/contracts/modules/articles/articles.validation";
import { NotFoundException } from "../http-exception";
import { rowsToCsv } from "../lib/csv";
import * as repo from "./articles.repository";

export async function list(db: Db, params?: { search?: string; page?: number; limit?: number }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const { data, total } = await repo.findAll(db, { search: params?.search, page, limit });
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string) {
  const article = await repo.findById(db, id);
  if (!article) throw new NotFoundException("Article not found");
  return { data: article };
}

export async function create(db: Db, input: CreateArticleInput, authorId: string) {
  const article = await repo.create(db, { ...input, authorId });
  return { data: article };
}

export async function update(db: Db, id: string, input: UpdateArticleInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Article not found");
  // R2 orphan cleanup lands with uploads module; skip storage delete for now.
  const updated = await repo.update(db, id, input);
  return { data: updated };
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Article not found");
  await repo.remove(db, id);
  return { data: { id } };
}

export async function exportCsv(db: Db, params?: { search?: string }) {
  const rows = await repo.findAllForExport(db, params?.search);
  const headers = ["id", "title", "date", "link", "img", "author", "authorId", "createdAt", "updatedAt"];
  const data = rows.map((a) => [
    a.id,
    a.title,
    a.date,
    a.link,
    a.img,
    a.author.name,
    a.authorId,
    a.createdAt,
    a.updatedAt,
  ]);
  return rowsToCsv(headers, data);
}
