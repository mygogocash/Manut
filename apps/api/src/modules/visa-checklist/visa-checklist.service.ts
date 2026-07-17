import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { visaChecklistRepository } from "@/modules/visa-checklist/visa-checklist.repository";
import type {
  ChecklistTemplateItemInput,
  ChecklistTemplateQuery,
  CreateChecklistTemplateInput,
  UpdateChecklistTemplateInput,
} from "@/modules/visa-checklist/visa-checklist.validation";

// Shape stored in VisaChecklistTemplate.items (validated on write).
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
    .filter(
      (it): it is Record<string, unknown> => !!it && typeof it === "object",
    )
    .map((it, i) => ({
      id: typeof it.id === "string" ? it.id : `item-${i}`,
      label: typeof it.label === "string" ? it.label : "",
      category: it.category === "step" ? "step" : "document",
      optional: it.optional === true,
      sortOrder: typeof it.sortOrder === "number" ? it.sortOrder : i,
    }))
    .filter((it) => it.label.length > 0);
}

export class VisaChecklistService {
  // ── Templates (HR admin) ────────────────────────────────

  async listTemplates(query: ChecklistTemplateQuery) {
    return visaChecklistRepository.listTemplates(query);
  }

  async getTemplate(id: string) {
    const t = await visaChecklistRepository.findTemplateById(id);
    if (!t) throw new NotFoundException("Checklist template not found");
    return t;
  }

  async createTemplate(input: CreateChecklistTemplateInput) {
    return visaChecklistRepository.createTemplate({
      visaType: input.visaType,
      country: input.country || null,
      name: input.name,
      items: normalizeItems(input.items ?? []),
      isActive: input.isActive ?? true,
      entityId: input.entityId || null,
    });
  }

  async updateTemplate(id: string, input: UpdateChecklistTemplateInput) {
    await this.getTemplate(id);
    return visaChecklistRepository.updateTemplate(id, {
      ...(input.visaType !== undefined && { visaType: input.visaType }),
      ...(input.country !== undefined && { country: input.country || null }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.items !== undefined && { items: normalizeItems(input.items) }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.entityId !== undefined && { entityId: input.entityId || null }),
    });
  }

  async deactivateTemplate(id: string) {
    await this.getTemplate(id);
    return visaChecklistRepository.updateTemplate(id, { isActive: false });
  }

  // ── Per-record checklist ────────────────────────────────

  // Instantiate the best matching template onto a new record. No-op (and
  // never throws) when no template matches — checklists are optional. Called
  // from visa.service.create(), so a failure must not block record creation.
  async hydrateChecklist(
    visaRecordId: string,
    visaType: string,
    country?: string | null,
  ): Promise<void> {
    try {
      // Skip if the record already has a checklist (idempotent re-runs).
      const existing = await visaChecklistRepository.countItems(visaRecordId);
      if (existing > 0) return;

      const candidates =
        await visaChecklistRepository.findMatchingTemplates(visaType);
      if (candidates.length === 0) return;

      // Prefer an exact-country template over a country-agnostic one.
      const exact = country
        ? candidates.find((t) => t.country === country)
        : undefined;
      const template = exact ?? candidates.find((t) => !t.country) ?? null;
      if (!template) return;

      const items = readItems(template.items);
      if (items.length === 0) return;

      await visaChecklistRepository.createItems(
        items.map((it) => ({
          visaRecordId,
          templateItemId: it.id,
          label: it.label,
          category: it.category,
          optional: it.optional,
          sortOrder: it.sortOrder,
        })),
      );
    } catch (err) {
      logger.warn("visa checklist hydrate failed", {
        err: err instanceof Error ? err.message : String(err),
        visaRecordId,
      });
    }
  }

  async getChecklist(visaRecordId: string) {
    return visaChecklistRepository.listItems(visaRecordId);
  }

  async toggleItem(
    visaRecordId: string,
    itemId: string,
    completed: boolean,
    actorId: string,
  ) {
    const item = await visaChecklistRepository.findItem(itemId);
    if (!item || item.visaRecordId !== visaRecordId) {
      throw new NotFoundException("Checklist item not found");
    }
    return visaChecklistRepository.updateItem(itemId, {
      completed,
      completedAt: completed ? new Date() : null,
      completedById: completed ? actorId : null,
    });
  }
}

// Validate + normalize template items before persisting to the JSON column.
function normalizeItems(items: ChecklistTemplateItemInput[]) {
  if (items.length > 50) {
    throw new BadRequestException("A template can have at most 50 items.");
  }
  return items.map((it, i) => ({
    id: it.id,
    label: it.label,
    category: it.category,
    optional: it.optional,
    sortOrder: it.sortOrder ?? i,
  }));
}

export const visaChecklistService = new VisaChecklistService();
