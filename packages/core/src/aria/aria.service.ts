import type {
  CreateConversationInput,
  CreateKnowledgeInput,
  KnowledgeQuery,
  UpdateKnowledgeInput,
} from "@nexora/contracts/modules/aria/aria.validation";
import type { Db } from "@nexora/db";
import { ConflictException, ForbiddenException, NotFoundException } from "../http-exception.js";
import { listToolsForPermissions } from "./aria-tools-registry.js";
import * as repo from "./aria.repository.js";

export async function listConversations(db: Db, userId: string) {
  const data = await repo.listConversations(db, userId);
  return { data };
}

export async function createConversation(db: Db, userId: string, input: CreateConversationInput) {
  const row = await repo.createConversation(db, userId, input.title ?? null);
  return { data: row };
}

export async function getConversation(db: Db, userId: string, id: string) {
  const conv = await repo.findConversation(db, userId, id);
  if (!conv) throw new NotFoundException("Conversation not found");
  const messages = await repo.listMessages(db, id);
  return { data: { ...conv, messages } };
}

export async function deleteConversation(db: Db, userId: string, id: string) {
  const conv = await repo.findConversation(db, userId, id);
  if (!conv) throw new NotFoundException("Conversation not found");
  await repo.deleteConversation(db, userId, id);
  return { data: { success: true } };
}

export function listTools(permissions: string[], isSystemAdmin: boolean) {
  return { data: listToolsForPermissions(permissions, isSystemAdmin) };
}

export async function listKnowledge(db: Db, query: KnowledgeQuery) {
  const data = await repo.listKnowledge(db, {
    category: query.category,
    isActive: query.isActive,
    search: query.search,
  });
  return { data };
}

export async function getKnowledge(db: Db, id: string) {
  const row = await repo.findKnowledgeById(db, id);
  if (!row) throw new NotFoundException("Knowledge article not found");
  return { data: row };
}

export async function createKnowledge(db: Db, actorId: string, input: CreateKnowledgeInput) {
  const existing = await repo.findKnowledgeBySlug(db, input.slug);
  if (existing) throw new ConflictException("Slug already in use");
  const row = await repo.createKnowledge(db, {
    id: crypto.randomUUID(),
    category: input.category,
    title: input.title,
    slug: input.slug,
    body: input.body,
    keywords: input.keywords ?? [],
    tags: input.tags ?? [],
    requiredPermissions: input.requiredPermissions ?? [],
    isActive: input.isActive ?? true,
    createdById: actorId,
  });
  return { data: row };
}

export async function updateKnowledge(db: Db, id: string, input: UpdateKnowledgeInput) {
  const existing = await repo.findKnowledgeById(db, id);
  if (!existing) throw new NotFoundException("Knowledge article not found");
  if (input.slug && input.slug !== existing.slug) {
    const clash = await repo.findKnowledgeBySlug(db, input.slug);
    if (clash && clash.id !== id) throw new ConflictException("Slug already in use");
  }
  const row = await repo.updateKnowledge(db, id, input);
  return { data: row };
}

export async function deleteKnowledge(db: Db, id: string) {
  const existing = await repo.findKnowledgeById(db, id);
  if (!existing) throw new NotFoundException("Knowledge article not found");
  await repo.deleteKnowledge(db, id);
  return { data: { success: true } };
}

export function assertKnowledgeManage(permissions: string[]) {
  if (!permissions.includes("aria:knowledge-manage")) {
    throw new ForbiddenException("Knowledge management requires aria:knowledge-manage");
  }
}
