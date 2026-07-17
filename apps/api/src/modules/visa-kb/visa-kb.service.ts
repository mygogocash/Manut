import { NotFoundException } from "@/common/exceptions/http-exception";
import { visaKbRepository } from "@/modules/visa-kb/visa-kb.repository";
import type {
  CreateVisaArticleInput,
  UpdateVisaArticleInput,
  VisaArticleQuery,
} from "@/modules/visa-kb/visa-kb.validation";

// kebab-case slug from a title; non-alphanumerics collapse to single dashes.
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

export class VisaKbService {
  async list(query: VisaArticleQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await visaKbRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const article = await visaKbRepository.findById(id);
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  async getForRecord(country?: string, visaType?: string) {
    return visaKbRepository.findForRecord(country, visaType);
  }

  // Find a free slug by appending -2, -3, … on collision.
  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let n = 2;
    while (await visaKbRepository.slugExists(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }

  async create(input: CreateVisaArticleInput, actorId: string) {
    const slug = await this.uniqueSlug(input.title);
    return visaKbRepository.create({
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

  async update(id: string, input: UpdateVisaArticleInput) {
    await this.getById(id);
    return visaKbRepository.update(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.country !== undefined && { country: input.country || null }),
      ...(input.visaType !== undefined && { visaType: input.visaType || null }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.entityId !== undefined && { entityId: input.entityId || null }),
    });
  }

  // Soft delete — articles may be referenced from runbooks / links, so we
  // deactivate rather than hard-delete.
  async deactivate(id: string) {
    await this.getById(id);
    return visaKbRepository.update(id, { isActive: false });
  }
}

export const visaKbService = new VisaKbService();
