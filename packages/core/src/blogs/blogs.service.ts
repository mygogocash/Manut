import type { Db } from "@nexora/db";
import type {
  CreateBlogInput,
  UpdateBlogInput,
} from "@nexora/contracts/modules/blogs/blogs.validation";
import { NotFoundException } from "../http-exception";
import { rowsToCsv } from "../lib/csv";
import * as repo from "./blogs.repository";

export async function list(db: Db, params?: { search?: string; page?: number; limit?: number }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const { data, total } = await repo.findAll(db, { search: params?.search, page, limit });
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string) {
  const blog = await repo.findById(db, id);
  if (!blog) throw new NotFoundException("Blog not found");
  return { data: blog };
}

export async function create(db: Db, input: CreateBlogInput, authorId: string) {
  const blog = await repo.create(db, {
    title: input.title,
    content: input.content,
    coverImage: input.coverImage,
    slug: input.slug,
    active: input.active,
    authorId,
  });
  return { data: blog };
}

export async function update(db: Db, id: string, input: UpdateBlogInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Blog not found");
  const updated = await repo.update(db, id, input);
  return { data: updated };
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Blog not found");
  await repo.remove(db, id);
  return { data: { id } };
}

export async function exportCsv(db: Db, params?: { search?: string }) {
  const rows = await repo.findAllForExport(db, params?.search);
  const headers = [
    "id",
    "title",
    "content",
    "coverImage",
    "slug",
    "active",
    "author",
    "authorId",
    "createdAt",
    "updatedAt",
  ];
  const data = rows.map((b) => [
    b.id,
    b.title,
    b.content,
    b.coverImage,
    b.slug ?? "",
    b.active,
    b.author.name,
    b.authorId,
    b.createdAt,
    b.updatedAt,
  ]);
  return rowsToCsv(headers, data);
}
