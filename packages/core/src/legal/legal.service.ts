import type {
  CreateLegalAttachmentInput,
  CreateLegalDocumentInput,
  CreateShareInput,
  LegalQuery,
  UpdateLegalAttachmentInput,
  UpdateLegalDocumentInput,
  UpdateVisibilityInput,
} from "@nexora/contracts/modules/legal/legal.validation";
import type { Db } from "@nexora/db";
import { ForbiddenException, NotFoundException } from "../http-exception";
import * as repo from "./legal.repository";

export async function list(db: Db, query: LegalQuery) {
  const { data, total } = await repo.findMany(db, query);
  return {
    data,
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) || 1 },
  };
}

export async function getById(db: Db, id: string) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Legal document not found");
  const [attachments, shares] = await Promise.all([
    repo.listAttachments(db, id),
    repo.listShares(db, id),
  ]);
  return { ...row, attachments, shares };
}

export async function create(db: Db, input: CreateLegalDocumentInput, actorId: string) {
  return repo.create(db, input, actorId);
}

export async function update(db: Db, id: string, input: UpdateLegalDocumentInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Legal document not found");
  return repo.update(db, id, input);
}

export async function remove(db: Db, id: string, actorId: string, permissions: string[]) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Legal document not found");
  const canDelete =
    permissions.includes("legal:delete") ||
    existing.ownerId === actorId ||
    permissions.some((p) => p.startsWith("admin"));
  if (!canDelete) throw new ForbiddenException("Cannot delete this document");
  await repo.remove(db, id);
  return { deleted: true };
}

export async function folders(db: Db) {
  return repo.listFolders(db);
}

async function assertDoc(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Legal document not found");
  return existing;
}

export async function addAttachment(db: Db, documentId: string, input: CreateLegalAttachmentInput, actorId: string) {
  await assertDoc(db, documentId);
  return repo.createAttachment(db, documentId, input, actorId);
}

export async function updateAttachment(
  db: Db,
  documentId: string,
  attachmentId: string,
  input: UpdateLegalAttachmentInput,
) {
  await assertDoc(db, documentId);
  const row = await repo.updateAttachment(db, documentId, attachmentId, input);
  if (!row) throw new NotFoundException("Attachment not found");
  return row;
}

export async function removeAttachment(db: Db, documentId: string, attachmentId: string) {
  await assertDoc(db, documentId);
  await repo.deleteAttachment(db, documentId, attachmentId);
  return { deleted: true };
}

export async function addShare(db: Db, documentId: string, input: CreateShareInput, actorId: string) {
  await assertDoc(db, documentId);
  return repo.createShare(db, documentId, input, actorId);
}

export async function removeShare(db: Db, documentId: string, shareId: string) {
  await assertDoc(db, documentId);
  await repo.deleteShare(db, documentId, shareId);
  return { deleted: true };
}

export async function setVisibility(db: Db, id: string, input: UpdateVisibilityInput) {
  await assertDoc(db, id);
  return repo.setVisibility(db, id, input.visibility);
}
