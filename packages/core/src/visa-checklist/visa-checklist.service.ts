import type {
  ChecklistTemplateItemInput,
  ChecklistTemplateQuery,
  CreateChecklistTemplateInput,
  UpdateChecklistTemplateInput,
} from "@nexora/contracts/modules/visa-checklist/visa-checklist.validation";
import type { Db } from "@nexora/db";
import { BadRequestException, NotFoundException } from "../http-exception";
import * as repo from "./visa-checklist.repository";

interface StoredTemplateItem {
  id: string;
  label: string;
  category: string;
  optional: boolean;
  sortOrder: number;
}

function readItems(raw: unknown): StoredTemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .map((it, i) => ({
      id: typeof it.id === "string" ? it.id : `item-${i}`,
      label: typeof it.label === "string" ? it.label : "",
      category: it.category === "step" ? "step" : "document",
      optional: it.optional === true,
      sortOrder: typeof it.sortOrder === "number" ? it.sortOrder : i,
    }))
    .filter((it) => it.label.length > 0);
}

function normalizeItems(items: ChecklistTemplateItemInput[]) {
  if (items.length > 50) throw new BadRequestException("A template can have at most 50 items.");
  return items.map((it, i) => ({
    id: it.id,
    label: it.label,
    category: it.category,
    optional: it.optional,
    sortOrder: it.sortOrder ?? i,
  }));
}

export async function listTemplates(db: Db, query: ChecklistTemplateQuery) {
  return repo.listTemplates(db, query);
}

export async function getTemplate(db: Db, id: string) {
  const t = await repo.findTemplateById(db, id);
  if (!t) throw new NotFoundException("Checklist template not found");
  return t;
}

export async function createTemplate(db: Db, input: CreateChecklistTemplateInput) {
  return repo.createTemplate(db, {
    visaType: input.visaType,
    country: input.country || null,
    name: input.name,
    items: normalizeItems(input.items ?? []),
    isActive: input.isActive ?? true,
    entityId: input.entityId || null,
  });
}

export async function updateTemplate(db: Db, id: string, input: UpdateChecklistTemplateInput) {
  await getTemplate(db, id);
  return repo.updateTemplate(db, id, {
    ...(input.visaType !== undefined && { visaType: input.visaType }),
    ...(input.country !== undefined && { country: input.country || null }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.items !== undefined && { items: normalizeItems(input.items) }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
    ...(input.entityId !== undefined && { entityId: input.entityId || null }),
  });
}

export async function deactivateTemplate(db: Db, id: string) {
  await getTemplate(db, id);
  return repo.updateTemplate(db, id, { isActive: false });
}

export async function hydrateChecklist(db: Db, visaRecordId: string, visaType: string, country?: string | null) {
  try {
    const existing = await repo.countItems(db, visaRecordId);
    if (existing > 0) return;
    const candidates = await repo.findMatchingTemplates(db, visaType);
    if (candidates.length === 0) return;
    const exact = country ? candidates.find((t) => t.country === country) : undefined;
    const template = exact ?? candidates.find((t) => !t.country) ?? null;
    if (!template) return;
    const items = readItems(template.items);
    if (items.length === 0) return;
    await repo.createItems(
      db,
      items.map((it) => ({
        visaRecordId,
        templateItemId: it.id,
        label: it.label,
        category: it.category,
        optional: it.optional,
        sortOrder: it.sortOrder,
        completed: false,
      })),
    );
  } catch {
    // best-effort — must not block visa record creation
  }
}

export async function getChecklist(db: Db, visaRecordId: string) {
  return repo.listItems(db, visaRecordId);
}

export async function toggleItem(db: Db, visaRecordId: string, itemId: string, completed: boolean, actorId: string) {
  const item = await repo.findItem(db, itemId);
  if (!item || item.visaRecordId !== visaRecordId) throw new NotFoundException("Checklist item not found");
  return repo.updateItem(db, itemId, {
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    completedById: completed ? actorId : null,
  });
}
