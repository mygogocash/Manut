import { NotFoundException } from "@/common/exceptions/http-exception";
import { rowsToCsv } from "@/common/utils/csv";
import {
  deleteFile,
  parseStorageUrl,
} from "@/infrastructure/storage/supabase-storage";
import { articlesRepository } from "@/modules/articles/articles.repository";
import type {
  CreateArticleInput,
  UpdateArticleInput,
} from "@/modules/articles/articles.validation";

export class ArticlesService {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = params ?? {};
    const [articles, total] = await articlesRepository.findAll({
      search,
      page,
      limit,
    });

    return {
      data: articles,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const article = await articlesRepository.findById(id);
    if (!article) throw new NotFoundException("Article not found");
    return { data: article };
  }

  async create(input: CreateArticleInput, authorId: string) {
    const article = await articlesRepository.create({
      title: input.title,
      link: input.link,
      date: input.date,
      img: input.img,
      author: { connect: { id: authorId } },
    });

    return { data: article };
  }

  async update(id: string, input: UpdateArticleInput) {
    const existing = await articlesRepository.findById(id);
    if (!existing) throw new NotFoundException("Article not found");

    if (input.img && input.img !== existing.img) {
      const parsed = parseStorageUrl(existing.img);
      if (parsed) {
        await deleteFile(parsed.bucket, parsed.path);
      }
    }

    const updated = await articlesRepository.update(id, input);
    return { data: updated };
  }

  async remove(id: string) {
    const existing = await articlesRepository.findById(id);
    if (!existing) throw new NotFoundException("Article not found");

    const parsed = parseStorageUrl(existing.img);
    if (parsed) {
      await deleteFile(parsed.bucket, parsed.path);
    }

    await articlesRepository.delete(id);
    return { data: { id } };
  }

  async exportCsv(params?: { search?: string }) {
    const rows = await articlesRepository.findAllForExport(params?.search);
    const headers = [
      "id",
      "title",
      "date",
      "link",
      "img",
      "author",
      "authorId",
      "createdAt",
      "updatedAt",
    ];
    const data = rows.map((a) => [
      a.id,
      a.title,
      a.date,
      a.link,
      a.img,
      a.author.name,
      a.authorId,
      a.createdAt.toISOString(),
      a.updatedAt.toISOString(),
    ]);
    return rowsToCsv(headers, data);
  }
}

export const articlesService = new ArticlesService();
