import type {
  CreateDocumentInput,
  ListDocumentsQuery,
  UpdateDocumentInput,
} from "@nexora/contracts/modules/dataroom/dataroom.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import * as repo from "./dataroom.repository";

export async function list(db: Db, query: ListDocumentsQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string) {
  const doc = await repo.findById(db, id);
  if (!doc) throw new NotFoundException("Document not found");
  return doc;
}

export async function upload(db: Db, uploadedBy: string, input: CreateDocumentInput) {
  return repo.create(db, {
    name: input.name,
    description: input.description,
    category: input.category ?? "other",
    fileUrl: input.fileUrl,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    uploadedBy,
  });
}

export async function update(db: Db, id: string, input: UpdateDocumentInput) {
  await getById(db, id);
  return repo.update(db, id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description ?? null }),
    ...(input.category !== undefined && { category: input.category }),
  });
}

export async function remove(db: Db, id: string) {
  await getById(db, id);
  await repo.remove(db, id);
}

export async function getCategorySummary(db: Db) {
  return repo.getCategorySummary(db);
}
